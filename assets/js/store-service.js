/**
 * STORE SERVICE - YOANA ZAFIRO / RONEOSHOP
 * Motor central de datos conectado a Firebase Firestore + Firebase Storage
 * con URLs y nombres limpios (products/{id}/1.webp, 2.webp...), URLs oficiales getDownloadURL,
 * protección estricta Anti-CORS en localhost y código de pedido diario DD-MM-YYYY-NNN.
 */

import {
  db,
  storage,
  firebaseConfig,
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  deleteDoc,
  updateDoc,
  writeBatch,
  ref,
  uploadBytes,
  uploadString,
  getDownloadURL,
  deleteObject,
  listAll,
  sanitizeForFirestore
} from './firebase-config.js';

// Claves de almacenamiento local y caché
const CACHE_KEY = 'store_products_cache_v7';
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutos para proteger la cuota gratuita de Firebase Spark
const FIRESTORE_VERIFIED_KEY = 'firestore_verified_v2';
const DB_PRODUCTS_KEY = 'store_db_products_v3';
const DB_SETTINGS_KEY = 'store_db_settings_v3';
const ORDERS_STORAGE_KEY = 'store_orders_v2';

// Limpieza de claves obsoletas
try {
  if (typeof localStorage !== 'undefined') {
    ['store_db_products_v1', 'store_db_products_v2', 'store_products_cache_v4', 'store_products_cache_v5', 'store_products_cache_v6'].forEach(k => localStorage.removeItem(k));
  }
  if (typeof sessionStorage !== 'undefined') {
    ['store_products_cache_v4', 'store_products_cache_v5', 'store_products_cache_v6'].forEach(k => sessionStorage.removeItem(k));
  }
} catch (e) {}

// Canal de difusión en tiempo real entre pestañas
const syncChannel = (typeof BroadcastChannel !== 'undefined') 
  ? new BroadcastChannel('roneoshop_live_sync') 
  : null;

/**
 * Generador de URL limpia de Firebase Storage
 */
export function buildCleanStorageUrl(filePath, version = '') {
  const bucket = firebaseConfig.storageBucket || "roneoshop-es.firebasestorage.app";
  const cleanPath = filePath.replace(/^\/+/, '');
  const encodedPath = cleanPath.split('/').map(segment => encodeURIComponent(segment)).join('%2F');
  const vParam = version ? `&v=${version}` : '';
  return `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodedPath}?alt=media${vParam}`;
}

/**
 * Invalida cachés locales y notifica a todas las pestañas abiertas
 */
export function invalidateCacheAndNotify(type = 'all') {
  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem(CACHE_KEY);
    }
    if (syncChannel) {
      syncChannel.postMessage({
        action: 'invalidate_cache',
        type,
        timestamp: Date.now()
      });
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('roneoshop_catalog_changed', { detail: { type } }));
    }
  } catch (err) {
    console.warn("[StoreService] Error notificando sincronización:", err);
  }
}

/**
 * Suscripción reactiva a cambios de catálogo en otras pestañas
 */
export function onStoreDataChanged(callback) {
  if (typeof window === 'undefined') return () => {};

  const handleCustomEvent = (e) => callback(e.detail);
  window.addEventListener('roneoshop_catalog_changed', handleCustomEvent);

  if (syncChannel) {
    const handleBroadcast = (e) => {
      if (e.data && e.data.action === 'invalidate_cache') {
        callback(e.data);
      }
    };
    syncChannel.addEventListener('message', handleBroadcast);
    return () => {
      window.removeEventListener('roneoshop_catalog_changed', handleCustomEvent);
      syncChannel.removeEventListener('message', handleBroadcast);
    };
  }

  return () => {
    window.removeEventListener('roneoshop_catalog_changed', handleCustomEvent);
  };
}

// ============================================================================
// 1. DATOS SEMILLA MAESTROS (MOCK Y AJUSTES)
// ============================================================================

export const MOCK_SETTINGS = {
  storeName: "Yoana Zafiro",
  storeTagline: "Moda y Tendencias Exclusivas",
  contactPhone: "+34 600 000 000",
  contactEmail: "contacto@yoanazafiro.com",
  freeShippingThreshold: 60.00,
  shippingStandardPrice: 4.90,
  announcementText: "ENVÍOS GRATIS A PARTIR DE €60 · COMPRA HOY Y RECÍBELO EN 24/48H",
  redsysMerchantCode: "999008881",
  redsysTerminal: "001",
  redsysCurrency: "978",
  packlinkApiKey: "pk_prod_live_2026_roneoshop_secure_token",
  packlinkDropoffActive: true,
  packlinkDefaultCarrier: "Correos Express 24h",
  categories: ["ropa", "calzado", "bolsos", "accesorios", "cabello"],
  collections: ["novedades", "bestsellers", "rebajas", "fiesta", "otono-invierno"],
  updatedAt: 1730715000000
};

export const MOCK_ORIGINAL_SOURCES = {
  "abrigo-pandora": [
    "https://cdn.shopify.com/s/files/1/0885/8494/6009/files/S3e430638541a46cf988863fdbf3dfc8eD.webp?v=1730282121",
    "https://cdn.shopify.com/s/files/1/0885/8494/6009/files/S5f2762a5b6d94d3eb97c8d927db32fe6Z.webp?v=1730282121"
  ],
  "vaquero-faja-levis": [
    "https://cdn.shopify.com/s/files/1/0885/8494/6009/files/S9eb61612aee44ea7ae630c50d3dd78f7o.webp?v=1730282121",
    "https://cdn.shopify.com/s/files/1/0885/8494/6009/files/S9cf36104c86e426db4f61b0a887a0e5b7.webp?v=1730282121",
    "https://cdn.shopify.com/s/files/1/0885/8494/6009/files/S4a2f8bdf942944b2a8d6b9d6a3628e93Y.webp?v=1730282121"
  ],
  "pantalon-hermes": [
    "https://cdn.shopify.com/s/files/1/0885/8494/6009/files/S068e8334460a4f5f8be78b54b0fcfa5ew.webp?v=1730282121",
    "https://cdn.shopify.com/s/files/1/0885/8494/6009/files/S199859f9ef754aa9a7850ad043ebbb25v.webp?v=1730282121"
  ],
  "vaquero-mitos": [
    "https://cdn.shopify.com/s/files/1/0885/8494/6009/files/Sff9a17ce70094b8e907ea692e21b7642w.webp?v=1730282121",
    "https://cdn.shopify.com/s/files/1/0885/8494/6009/files/Sd5e9eaae7f3b4ba9bc4389df0b62e4f0X.webp?v=1730282121"
  ],
  "pantalon-furor-bicolor": [
    "https://cdn.shopify.com/s/files/1/0885/8494/6009/files/S8b1089d81dbe439f8021c37d6e4999ab9.webp?v=1730282121",
    "https://cdn.shopify.com/s/files/1/0885/8494/6009/files/Sbbad07798363413da66a15db4ca2c418g.webp?v=1730282121"
  ],
  "conjunto-punto-roma": [
    "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=900&q=80",
    "https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=900&q=80"
  ],
  "vestido-midi-seda": [
    "https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?auto=format&fit=crop&w=900&q=80",
    "https://images.unsplash.com/photo-1496747611176-843222e1e57c?auto=format&fit=crop&w=900&q=80"
  ],
  "bota-cowboy-piel": [
    "https://images.unsplash.com/photo-1543163521-1bf539c55dd2?auto=format&fit=crop&w=900&q=80",
    "https://images.unsplash.com/photo-1549298916-b41d501d3772?auto=format&fit=crop&w=900&q=80"
  ],
  "bolso-shopper-cuero": [
    "https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=900&q=80",
    "https://images.unsplash.com/photo-1590874103328-eac38a683ce7?auto=format&fit=crop&w=900&q=80"
  ],
  "cinturon-hebilla-oro": [
    "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=900&q=80"
  ],
  "extensiones-clip-natural": [
    "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=900&q=80",
    "https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=900&q=80"
  ],
  "peluca-lace-front-ondulada": [
    "https://images.unsplash.com/photo-1562322140-8baeececf3df?auto=format&fit=crop&w=900&q=80",
    "https://images.unsplash.com/photo-1595476108010-b4d1f102b1b1?auto=format&fit=crop&w=900&q=80"
  ]
};

export const MOCK_PRODUCTS = [
  // 1. ABRIGO PANDORA
  {
    id: "abrigo-pandora",
    slug: "abrigo-pandora",
    title: "ABRIGO PANDORA",
    category: "ropa",
    subCategory: "abrigos",
    collectionTags: ["otono-invierno", "novedades", "fiesta"],
    price: 38.00,
    compareAtPrice: 45.00,
    weightKg: 0.95,
    description: "Abrigo midi con diseño cruzado, solapas oversize y cinturón a juego para estilizar la silueta. Confeccionado en paño suave de primera calidad con forro interior térmico satinado.",
    hasSizes: true,
    colors: [
      { name: "Gris", hex: "#8a8d91", inStock: true },
      { name: "Negro", hex: "#121212", inStock: true },
      { name: "Camel", hex: "#c19a6b", inStock: true }
    ],
    images: [
      buildCleanStorageUrl("products/abrigo-pandora/1.webp"),
      buildCleanStorageUrl("products/abrigo-pandora/2.webp")
    ],
    variants: [
      { size: "XS", stock: 3, sku: "AB-PAN-XS" },
      { size: "S", stock: 6, sku: "AB-PAN-S" },
      { size: "M", stock: 8, sku: "AB-PAN-M" },
      { size: "L", stock: 4, sku: "AB-PAN-L" },
      { size: "XL", stock: 2, sku: "AB-PAN-XL" }
    ],
    active: true,
    featured: true,
    createdAt: 1730715000000
  },

  // 2. VAQUERO FAJA LEVIS
  {
    id: "vaquero-faja-levis",
    slug: "vaquero-faja-levis",
    title: "VAQUERO FAJA LEVIS",
    category: "ropa",
    subCategory: "vaqueros",
    collectionTags: ["bestsellers", "novedades"],
    price: 24.95,
    compareAtPrice: 29.95,
    weightKg: 0.55,
    description: "Vaquero pitillo con efecto faja moldeadora y tiro extra alto que estiliza la figura proporcionando máxima comodidad.",
    hasSizes: true,
    colors: [
      { name: "Azul Denim", hex: "#3b5998", inStock: true },
      { name: "Negro", hex: "#121212", inStock: true }
    ],
    images: [
      buildCleanStorageUrl("products/vaquero-faja-levis/1.webp"),
      buildCleanStorageUrl("products/vaquero-faja-levis/2.webp"),
      buildCleanStorageUrl("products/vaquero-faja-levis/3.webp")
    ],
    variants: [
      { size: "XS", stock: 2, sku: "VF-LEV-XS" },
      { size: "S", stock: 4, sku: "VF-LEV-S" },
      { size: "M", stock: 6, sku: "VF-LEV-M" },
      { size: "L", stock: 3, sku: "VF-LEV-L" },
      { size: "XL", stock: 2, sku: "VF-LEV-XL" }
    ],
    active: true,
    featured: true,
    createdAt: 1730715100000
  },

  // 3. PANTALÓN HERMES
  {
    id: "pantalon-hermes",
    slug: "pantalon-hermes",
    title: "PANTALÓN HERMES",
    category: "ropa",
    subCategory: "pantalones",
    collectionTags: ["otono-invierno", "novedades"],
    price: 18.75,
    compareAtPrice: null,
    weightKg: 0.40,
    description: "Pantalón sastre con pinzas marcadas, caída fluida y tiro medio adaptable. Perfecto para conjuntos formales y de oficina.",
    hasSizes: true,
    colors: [
      { name: "Gris Marengo", hex: "#555555", inStock: true },
      { name: "Negro", hex: "#121212", inStock: true }
    ],
    images: [
      buildCleanStorageUrl("products/pantalon-hermes/1.webp"),
      buildCleanStorageUrl("products/pantalon-hermes/2.webp")
    ],
    variants: [
      { size: "S", stock: 3, sku: "PA-HER-S" },
      { size: "M", stock: 5, sku: "PA-HER-M" },
      { size: "L", stock: 2, sku: "PA-HER-L" }
    ],
    active: true,
    featured: true,
    createdAt: 1730715200000
  },

  // 4. VAQUERO MITOS
  {
    id: "vaquero-mitos",
    slug: "vaquero-mitos",
    title: "VAQUERO MITOS",
    category: "ropa",
    subCategory: "vaqueros",
    collectionTags: ["bestsellers"],
    price: 26.50,
    compareAtPrice: 32.00,
    weightKg: 0.58,
    description: "Vaquero recto de inspiración retro con tiro alto y tejido denim 100% de textura premium y duradera.",
    hasSizes: true,
    colors: [
      { name: "Lavado Medio", hex: "#4b6f96", inStock: true }
    ],
    images: [
      buildCleanStorageUrl("products/vaquero-mitos/1.webp"),
      buildCleanStorageUrl("products/vaquero-mitos/2.webp")
    ],
    variants: [
      { size: "XS", stock: 1, sku: "VQ-MIT-XS" },
      { size: "S", stock: 4, sku: "VQ-MIT-S" },
      { size: "M", stock: 7, sku: "VQ-MIT-M" },
      { size: "L", stock: 5, sku: "VQ-MIT-L" }
    ],
    active: true,
    featured: true,
    createdAt: 1730715300000
  },

  // 5. PANTALÓN FUROR BICOLOR
  {
    id: "pantalon-furor-bicolor",
    slug: "pantalon-furor-bicolor",
    title: "PANTALÓN FUROR BICOLOR",
    category: "ropa",
    subCategory: "pantalones",
    collectionTags: ["novedades", "fiesta"],
    price: 22.00,
    compareAtPrice: 28.00,
    weightKg: 0.42,
    description: "Diseño audaz en dos tonalidades contrastadas con pernera ancha wide-leg y cintura elástica muy confortable.",
    hasSizes: true,
    colors: [
      { name: "Blanco/Negro", hex: "#121212", inStock: true }
    ],
    images: [
      buildCleanStorageUrl("products/pantalon-furor-bicolor/1.webp"),
      buildCleanStorageUrl("products/pantalon-furor-bicolor/2.webp")
    ],
    variants: [
      { size: "S", stock: 2, sku: "PA-FUR-S" },
      { size: "M", stock: 6, sku: "PA-FUR-M" },
      { size: "L", stock: 3, sku: "PA-FUR-L" }
    ],
    active: true,
    featured: true,
    createdAt: 1730715400000
  },

  // 6. CONJUNTO PUNTO ROMA
  {
    id: "conjunto-punto-roma",
    slug: "conjunto-punto-roma",
    title: "CONJUNTO PUNTO ROMA",
    category: "ropa",
    subCategory: "conjuntos",
    collectionTags: ["otono-invierno", "bestsellers"],
    price: 34.50,
    compareAtPrice: 42.00,
    weightKg: 0.70,
    description: "Dos piezas en punto elástico de alta densidad compuesto por jersey oversize con cuello vuelto y pantalón culotte.",
    hasSizes: true,
    colors: [
      { name: "Beige Cálido", hex: "#d8c4b6", inStock: true },
      { name: "Verde Oliva", hex: "#556b2f", inStock: true }
    ],
    images: [
      buildCleanStorageUrl("products/conjunto-punto-roma/1.webp"),
      buildCleanStorageUrl("products/conjunto-punto-roma/2.webp")
    ],
    variants: [
      { size: "S", stock: 4, sku: "CJ-ROM-S" },
      { size: "M", stock: 5, sku: "CJ-ROM-M" },
      { size: "L", stock: 2, sku: "CJ-ROM-L" }
    ],
    active: true,
    featured: true,
    createdAt: 1730715500000
  },

  // 7. VESTIDO MIDI SEDA
  {
    id: "vestido-midi-seda",
    slug: "vestido-midi-seda",
    title: "VESTIDO MIDI SEDA",
    category: "ropa",
    subCategory: "vestidos",
    collectionTags: ["fiesta", "novedades"],
    price: 49.90,
    compareAtPrice: 59.90,
    weightKg: 0.32,
    description: "Vestido lencero de corte al bies con escote cascada drapeado y tirantes finos regulables. Brillo suave y tacto sedoso.",
    hasSizes: true,
    colors: [
      { name: "Burdeos", hex: "#800020", inStock: true },
      { name: "Champagne", hex: "#f7e7ce", inStock: true }
    ],
    images: [
      buildCleanStorageUrl("products/vestido-midi-seda/1.webp"),
      buildCleanStorageUrl("products/vestido-midi-seda/2.webp")
    ],
    variants: [
      { size: "XS", stock: 2, sku: "VE-SED-XS" },
      { size: "S", stock: 5, sku: "VE-SED-S" },
      { size: "M", stock: 4, sku: "VE-SED-M" },
      { size: "L", stock: 1, sku: "VE-SED-L" }
    ],
    active: true,
    featured: true,
    createdAt: 1730715600000
  },

  // 8. BOTA COWBOY PIEL
  {
    id: "bota-cowboy-piel",
    slug: "bota-cowboy-piel",
    title: "BOTA COWBOY PIEL",
    category: "calzado",
    subCategory: "botas",
    collectionTags: ["bestsellers", "otono-invierno"],
    price: 59.00,
    compareAtPrice: 75.00,
    weightKg: 1.10,
    description: "Bota campera de media caña con bordados florales tradicionales al tono, tacón cubano cómodo de 5cm y suela acolchada.",
    hasSizes: true,
    colors: [
      { name: "Cuero Marrón", hex: "#8b5a2b", inStock: true },
      { name: "Negro Ébano", hex: "#121212", inStock: true }
    ],
    images: [
      buildCleanStorageUrl("products/bota-cowboy-piel/1.webp"),
      buildCleanStorageUrl("products/bota-cowboy-piel/2.webp")
    ],
    variants: [
      { size: "36", stock: 2, sku: "BO-COW-36" },
      { size: "37", stock: 3, sku: "BO-COW-37" },
      { size: "38", stock: 5, sku: "BO-COW-38" },
      { size: "39", stock: 4, sku: "BO-COW-39" },
      { size: "40", stock: 2, sku: "BO-COW-40" }
    ],
    active: true,
    featured: true,
    createdAt: 1730715700000
  },

  // 9. BOLSO SHOPPER CUERO
  {
    id: "bolso-shopper-cuero",
    slug: "bolso-shopper-cuero",
    title: "BOLSO SHOPPER CUERO",
    category: "bolsos",
    subCategory: "shoppers",
    collectionTags: ["novedades"],
    price: 36.00,
    compareAtPrice: 45.00,
    weightKg: 0.65,
    description: "Bolso de hombro de gran capacidad con doble asa reforzada, cierre con cremallera y neceser interior extraíble.",
    hasSizes: false,
    colors: [
      { name: "Cuero Natural", hex: "#966f33", inStock: true },
      { name: "Negro", hex: "#121212", inStock: true }
    ],
    images: [
      buildCleanStorageUrl("products/bolso-shopper-cuero/1.webp"),
      buildCleanStorageUrl("products/bolso-shopper-cuero/2.webp")
    ],
    variants: [
      { size: "ÚNICA", stock: 12, sku: "BL-SHO-U" }
    ],
    active: true,
    featured: true,
    createdAt: 1730715800000
  },

  // 10. CINTURÓN HEBILLA ORO
  {
    id: "cinturon-hebilla-oro",
    slug: "cinturon-hebilla-oro",
    title: "CINTURÓN HEBILLA ORO",
    category: "accesorios",
    subCategory: "cinturones",
    collectionTags: ["bestsellers"],
    price: 14.95,
    compareAtPrice: null,
    weightKg: 0.18,
    description: "Cinturón de piel con hebilla metálica circular en baño dorado pulido. Ajustable para tiro de pantalón o cintura de vestido.",
    hasSizes: true,
    colors: [
      { name: "Negro", hex: "#121212", inStock: true },
      { name: "Marrón", hex: "#5c4033", inStock: true }
    ],
    images: [
      buildCleanStorageUrl("products/cinturon-hebilla-oro/1.webp")
    ],
    variants: [
      { size: "85", stock: 5, sku: "CI-ORO-85" },
      { size: "90", stock: 6, sku: "CI-ORO-90" },
      { size: "95", stock: 4, sku: "CI-ORO-95" }
    ],
    active: true,
    featured: false,
    createdAt: 1730715900000
  },

  // 11. EXTENSIONES CLIP NATURAL
  {
    id: "extensiones-clip-natural",
    slug: "extensiones-clip-natural",
    title: "EXTENSIONES CLIP NATURAL",
    category: "cabello",
    subCategory: "extensiones",
    collectionTags: ["novedades", "bestsellers"],
    price: 78.00,
    compareAtPrice: 95.00,
    weightKg: 0.25,
    description: "Set de 7 piezas de cabello 100% natural Remy de 55cm. Listas para moldear con plancha o tenacilla y máxima fijación con clips de silicona.",
    hasSizes: true,
    colors: [
      { name: "Castaño Oscuro #2", hex: "#2b1e16", inStock: true },
      { name: "Rubio Ceniza #18", hex: "#b5a382", inStock: true },
      { name: "Negro Azabache #1", hex: "#0b0b0b", inStock: true }
    ],
    images: [
      buildCleanStorageUrl("products/extensiones-clip-natural/1.webp"),
      buildCleanStorageUrl("products/extensiones-clip-natural/2.webp")
    ],
    variants: [
      { size: "45 CM", stock: 3, sku: "EXT-45" },
      { size: "55 CM", stock: 6, sku: "EXT-55" },
      { size: "65 CM", stock: 2, sku: "EXT-65" }
    ],
    active: true,
    featured: true,
    createdAt: 1730716000000
  },

  // 12. PELUCA LACE FRONT ONDULADA
  {
    id: "peluca-lace-front-ondulada",
    slug: "peluca-lace-front-ondulada",
    title: "PELUCA LACE FRONT ONDULADA",
    category: "cabello",
    subCategory: "pelucas",
    collectionTags: ["fiesta"],
    price: 110.00,
    compareAtPrice: 135.00,
    weightKg: 0.45,
    description: "Peluca lace front con nacimiento invisible HD y ondas al agua definidas de 60cm de longitud. Gorro interior transpirable y correas de sujeción.",
    hasSizes: false,
    colors: [
      { name: "Moreno Chocolate", hex: "#3d2314", inStock: true },
      { name: "Rubio Balayage", hex: "#c9b086", inStock: true }
    ],
    images: [
      buildCleanStorageUrl("products/peluca-lace-front-ondulada/1.webp"),
      buildCleanStorageUrl("products/peluca-lace-front-ondulada/2.webp")
    ],
    variants: [
      { size: "ÚNICA", stock: 4, sku: "PEL-LAC-U" }
    ],
    active: true,
    featured: false,
    createdAt: 1730716100000
  }
];

export const INITIAL_SAMPLE_ORDERS = [
  {
    orderNumber: "05-11-2026-001",
    status: "PAID",
    paymentMethod: "REDSYS",
    redsysOrderId: "05112026001",
    customer: {
      name: "Carmen Gómez Ruiz",
      email: "carmen.gomez@gmail.com",
      phone: "+34 654 321 987",
      address: "Calle Serrano 45, 3º B",
      postalCode: "28001",
      city: "Madrid",
      province: "Madrid",
      country: "ES"
    },
    items: [
      {
        productId: "abrigo-pandora",
        title: "ABRIGO PANDORA",
        size: "M",
        price: 38.00,
        quantity: 1,
        image: buildCleanStorageUrl("products/abrigo-pandora/1.webp")
      },
      {
        productId: "vaquero-faja-levis",
        title: "VAQUERO FAJA LEVIS",
        size: "S",
        price: 24.95,
        quantity: 1,
        image: buildCleanStorageUrl("products/vaquero-faja-levis/1.webp")
      }
    ],
    pricing: {
      subtotal: 62.95,
      shipping: 0.00,
      total: 62.95
    },
    packlink: {
      service: "Correos Express 24h",
      trackingNumber: "ES20261105001",
      labelUrl: "https://api.packlink.com/v1/shipments/print/ES20261105001",
      parcelWeightKg: 1.50
    },
    createdAt: 1730800000000
  },
  {
    orderNumber: "05-11-2026-002",
    status: "PAID",
    paymentMethod: "BIZUM",
    redsysOrderId: "05112026002",
    customer: {
      name: "Lucía Fernández Torres",
      email: "lucia.ft@gmail.com",
      phone: "+34 611 223 344",
      address: "Avenida Diagonal 210, 4º 1ª",
      postalCode: "08018",
      city: "Barcelona",
      province: "Barcelona",
      country: "ES"
    },
    items: [
      {
        productId: "bota-cowboy-piel",
        title: "BOTA COWBOY PIEL",
        size: "38",
        price: 59.00,
        quantity: 1,
        image: buildCleanStorageUrl("products/bota-cowboy-piel/1.webp")
      }
    ],
    pricing: {
      subtotal: 59.00,
      shipping: 4.90,
      total: 63.90
    },
    packlink: {
      service: "Correos Express 24h",
      trackingNumber: "ES20261105002",
      labelUrl: "https://api.packlink.com/v1/shipments/print/ES20261105002",
      parcelWeightKg: 1.10
    },
    createdAt: 1730803600000
  }
];

// ============================================================================
// 2. COMPRESIÓN Y GESTIÓN DE ARCHIVOS EN FIREBASE STORAGE
// ============================================================================

/**
 * Convierte cualquier origen de imagen en Blob WebP
 * Cumple estrictamente las reglas anti-CORS en localhost
 */
export async function imageSourceToWebpBlob(source, maxHeight = 1100, quality = 0.84) {
  if (!source) throw new Error("Origen de imagen vacío");

  // Si ya es un Blob WebP, devolverlo directamente
  if (source instanceof Blob && source.type === 'image/webp') {
    return source;
  }

  // Si ya es una URL de Firebase Storage, no re-procesar en canvas
  if (typeof source === 'string' && source.includes('firebasestorage.googleapis.com')) {
    return source;
  }

  if (typeof document === 'undefined' || typeof window === 'undefined') {
    return new Blob([], { type: 'image/webp' });
  }

  let objectUrl = null;

  try {
    const imgElement = new Image();

    if (source instanceof File || source instanceof Blob) {
      // Para archivos locales o blobs: NUNCA usar crossOrigin = "anonymous"
      objectUrl = URL.createObjectURL(source);
      await new Promise((res, rej) => {
        imgElement.onload = () => res(imgElement);
        imgElement.onerror = (e) => rej(e);
        imgElement.src = objectUrl;
      });
    } else if (typeof source === 'string') {
      if (source.startsWith('data:image')) {
        // Para DataURLs locales: NUNCA usar crossOrigin = "anonymous"
        await new Promise((res, rej) => {
          imgElement.onload = () => res(imgElement);
          imgElement.onerror = (e) => rej(e);
          imgElement.src = source;
        });
      } else {
        // Para URLs externas (Shopify / Unsplash): descargar mediante proxy CORS wsrv.nl
        const proxyUrl = `https://wsrv.nl/?url=${encodeURIComponent(source)}&h=${maxHeight}&output=webp&q=84`;

        try {
          const resp = await fetch(proxyUrl, { mode: 'cors' });
          if (!resp.ok) throw new Error(`Fetch wsrv falló con status ${resp.status}`);
          const blob = await resp.blob();
          objectUrl = URL.createObjectURL(blob);
          await new Promise((res, rej) => {
            imgElement.onload = () => res(imgElement);
            imgElement.onerror = (e) => rej(e);
            imgElement.src = objectUrl;
          });
        } catch (fetchErr) {
          console.warn("[StoreService] Fallback descarga imagen externa:", fetchErr);
          // Si el proxy fallara, devolver el string original sin bloquear el flujo
          return source;
        }
      }
    }

    let width = imgElement.width || 800;
    let height = imgElement.height || 1000;

    if (height > maxHeight) {
      width = Math.round(width * (maxHeight / height));
      height = maxHeight;
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    ctx.drawImage(imgElement, 0, 0, width, height);

    return await new Promise((resolve) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else resolve(source); // Fallback seguro
      }, 'image/webp', quality);
    });

  } catch (err) {
    console.warn("[StoreService] Error procesando imagen en canvas, devolviendo origen:", err);
    return source;
  } finally {
    if (objectUrl) {
      try { URL.revokeObjectURL(objectUrl); } catch (e) {}
    }
  }
}

/**
 * LEY 1 ANTI-CORS:
 * Si imageSource ya es de firebasestorage.googleapis.com, se devuelve inmediatamente.
 * Si es una imagen nueva, se sube a Storage y se devuelve su getDownloadURL oficial.
 */
export async function uploadProductImage(imageSource, productId, index = 0, forceReupload = false) {
  // 1. Si ya es una URL alojada en Firebase Storage, DEVUÉLVELA TAL CUAL AL INSTANTE.
  if (
    !forceReupload &&
    typeof imageSource === 'string' &&
    imageSource.includes('firebasestorage.googleapis.com')
  ) {
    return imageSource;
  }

  // 2. Comprimir imagen nueva (File, Blob, dataUrl o URL externa)
  const processed = await imageSourceToWebpBlob(imageSource, 1100, 0.84);

  // Si procesado devolvió un string directo (fallback), devolverlo
  if (typeof processed === 'string' && processed.startsWith('http')) {
    return processed;
  }

  // 3. Subir archivo físico a Firebase Storage: products/{productId}/{index + 1}.webp
  const filePath = `products/${productId}/${index + 1}.webp`;
  const storageRef = ref(storage, filePath);

  await uploadBytes(storageRef, processed, {
    contentType: 'image/webp',
    cacheControl: 'public,max-age=31536000'
  });

  // 4. Obtener SIEMPRE la URL oficial de descarga getDownloadURL
  const officialDownloadUrl = await getDownloadURL(storageRef);
  return officialDownloadUrl;
}

/**
 * Migra imágenes externas pendientes a Firebase Storage con getDownloadURL oficial
 */
export async function migrateAllImagesToFirebaseStorage(onProgressCallback) {
  try {
    const products = await getProducts({ forceRefresh: true });
    let totalImagesToProcess = 0;

    products.forEach(p => {
      const origs = MOCK_ORIGINAL_SOURCES[p.id] || p.images || [];
      totalImagesToProcess += origs.length;
    });

    let processedCount = 0;
    let migratedCount = 0;

    for (const product of products) {
      const originalSources = MOCK_ORIGINAL_SOURCES[product.id] || product.images || [];
      const newCleanUrls = [];
      let productModified = false;

      for (let i = 0; i < originalSources.length; i++) {
        const sourceUrl = originalSources[i];
        processedCount++;

        if (typeof onProgressCallback === 'function') {
          onProgressCallback({
            productId: product.id,
            productTitle: product.title,
            current: processedCount,
            total: totalImagesToProcess
          });
        }

        try {
          const officialUrl = await uploadProductImage(sourceUrl, product.id, i, false);
          newCleanUrls.push(officialUrl);
          productModified = true;
          migratedCount++;
        } catch (uploadErr) {
          console.warn(`[Migrate] Aviso subiendo foto ${i} de "${product.title}":`, uploadErr);
          newCleanUrls.push(sourceUrl);
        }
      }

      if (productModified && newCleanUrls.length > 0) {
        product.images = newCleanUrls;
        product.updatedAt = Date.now();
        await setDoc(doc(db, "products", product.id), sanitizeForFirestore(product), { merge: true });
      }
    }

    invalidateCacheAndNotify('storage_migrated');
    return { ok: true, migratedCount };

  } catch (err) {
    console.error("[StoreService] Error migrando catálogo a Storage:", err);
    return { ok: false, migratedCount: 0 };
  }
}

/**
 * Limpia pedidos con IDs obsoletos en Firestore y siembra los dos oficiales
 */
export async function cleanLegacyOrdersInFirestore() {
  try {
    const ordersSnap = await getDocs(collection(db, "orders"));
    const batch = writeBatch(db);
    let countDeleted = 0;

    ordersSnap.forEach(d => {
      const num = d.data().orderNumber || d.id;
      // Formato válido: DD-MM-YYYY-NNN (ej. 05-11-2026-001)
      if (!/^\d{2}-\d{2}-\d{4}-\d{3}$/.test(num)) {
        batch.delete(doc(db, "orders", d.id));
        countDeleted++;
      }
    });

    if (countDeleted > 0) {
      await batch.commit();
      console.log(`[StoreService] Eliminados ${countDeleted} pedidos con código obsoleto`);
    }

    // Asegurar que los dos pedidos oficiales existen
    for (const sample of INITIAL_SAMPLE_ORDERS) {
      await setDoc(doc(db, "orders", sample.orderNumber), sanitizeForFirestore(sample), { merge: true });
    }

    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(INITIAL_SAMPLE_ORDERS));
    }
  } catch (err) {
    console.warn("[StoreService] Aviso limpiando pedidos legacy:", err);
  }
}

/**
 * Generador de número de pedido diario: DD-MM-YYYY-NNN (ej. 05-11-2026-001)
 */
export async function generateNextOrderNumber(dateObj = new Date()) {
  const d = String(dateObj.getDate()).padStart(2, '0');
  const m = String(dateObj.getMonth() + 1).padStart(2, '0');
  const y = String(dateObj.getFullYear());
  const datePrefix = `${d}-${m}-${y}`;

  const currentOrders = await getOrders({ forceRefresh: true });
  const todaysOrders = currentOrders.filter(o => (o.orderNumber || '').startsWith(datePrefix));

  let maxSeq = 0;
  todaysOrders.forEach(o => {
    const parts = (o.orderNumber || '').split('-');
    if (parts.length === 4) {
      const seq = parseInt(parts[3], 10);
      if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
    }
  });

  const nextSeq = String(maxSeq + 1).padStart(3, '0');
  return `${datePrefix}-${nextSeq}`;
}

// ============================================================================
// 3. SINCRONIZACIÓN Y SIEMBRA DE FIRESTORE
// ============================================================================

export async function syncAllToFirestore({ forceOverwrite = false } = {}) {
  try {
    const productsSnap = await getDocs(collection(db, "products"));
    const shouldSeedProducts = productsSnap.empty || forceOverwrite;

    if (shouldSeedProducts) {
      const batch = writeBatch(db);
      for (const prod of MOCK_PRODUCTS) {
        const prodRef = doc(db, "products", prod.id);
        batch.set(prodRef, sanitizeForFirestore(prod));
      }
      await batch.commit();
    }

    const settingsDoc = await getDoc(doc(db, "settings", "store_config"));
    if (!settingsDoc.exists() || forceOverwrite) {
      await setDoc(doc(db, "settings", "store_config"), sanitizeForFirestore(MOCK_SETTINGS));
    }

    const ordersSnap = await getDocs(collection(db, "orders"));
    if (ordersSnap.empty || forceOverwrite) {
      const ordersBatch = writeBatch(db);
      for (const order of INITIAL_SAMPLE_ORDERS) {
        ordersBatch.set(doc(db, "orders", order.orderNumber), sanitizeForFirestore(order));
      }
      await ordersBatch.commit();
    }

    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(FIRESTORE_VERIFIED_KEY, 'true');
    }

    invalidateCacheAndNotify('firestore_seeded');
    return { ok: true, productsCount: MOCK_PRODUCTS.length };

  } catch (err) {
    console.error("[StoreService] Error en syncAllToFirestore:", err);
    throw err;
  }
}

// ============================================================================
// 4. CONSULTA Y GESTIÓN DE PRODUCTOS
// ============================================================================

export async function getProducts(options = {}) {
  const forceRefresh = typeof options === 'boolean' ? options : !!options.forceRefresh;

  // 1. Comprobar caché en sessionStorage (validez 10 minutos)
  if (!forceRefresh && typeof sessionStorage !== 'undefined') {
    try {
      const cached = sessionStorage.getItem(CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.timestamp && (Date.now() - parsed.timestamp < CACHE_TTL_MS)) {
          return parsed.data;
        }
      }
    } catch (e) {}
  }

  let products = [];

  // 2. Intentar lectura desde Cloud Firestore
  try {
    const snap = await getDocs(collection(db, "products"));
    if (!snap.empty) {
      snap.forEach(d => {
        products.push({ id: d.id, ...d.data() });
      });
    } else {
      // Auto-semilla inicial si Firestore está vacío
      await syncAllToFirestore({ forceOverwrite: false });
      products = [...MOCK_PRODUCTS];
    }
  } catch (firestoreErr) {
    console.warn("[StoreService] Firestore no disponible, usando fallback local:", firestoreErr.message);

    if (typeof localStorage !== 'undefined') {
      const localData = localStorage.getItem(DB_PRODUCTS_KEY);
      if (localData) {
        try { products = JSON.parse(localData); } catch (e) {}
      }
    }

    if (!products || products.length === 0) {
      products = [...MOCK_PRODUCTS];
    }
  }

  // Sincronizar en localStorage y sessionStorage
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(DB_PRODUCTS_KEY, JSON.stringify(products));
    }
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(CACHE_KEY, JSON.stringify({
        timestamp: Date.now(),
        data: products
      }));
    }
  } catch (e) {}

  return products;
}

export async function getProductByIdOrSlug(idOrSlug) {
  if (!idOrSlug) return null;
  const products = await getProducts();
  const cleanTerm = String(idOrSlug).toLowerCase().trim();
  return products.find(p => 
    String(p.id).toLowerCase() === cleanTerm || 
    String(p.slug || '').toLowerCase() === cleanTerm
  ) || null;
}

export async function getProductsByFilter(filters = {}) {
  const {
    category = 'all',
    collectionTag = 'all',
    minPrice = 0,
    maxPrice = Infinity,
    sortBy = 'featured',
    search = ''
  } = filters;

  const allProducts = await getProducts();

  let filtered = allProducts.filter(p => {
    if (p.active === false) return false;

    if (category !== 'all' && p.category !== category) return false;

    if (collectionTag !== 'all') {
      const tags = Array.isArray(p.collectionTags) ? p.collectionTags : [];
      if (!tags.includes(collectionTag) && p.subCategory !== collectionTag) return false;
    }

    if (p.price < minPrice || p.price > maxPrice) return false;

    if (search) {
      const term = search.toLowerCase();
      const titleMatch = (p.title || '').toLowerCase().includes(term);
      const descMatch = (p.description || '').toLowerCase().includes(term);
      if (!titleMatch && !descMatch) return false;
    }

    return true;
  });

  switch (sortBy) {
    case 'price-asc':
      filtered.sort((a, b) => a.price - b.price);
      break;
    case 'price-desc':
      filtered.sort((a, b) => b.price - a.price);
      break;
    case 'newest':
      filtered.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      break;
    case 'title-asc':
      filtered.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
      break;
    case 'featured':
    default:
      filtered.sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0));
      break;
  }

  return filtered;
}

export async function getRelatedProducts(currentProductId, categoryOrLimit = 4, maybeLimit = 4) {
  let category = null;
  let limit = 4;

  if (typeof categoryOrLimit === 'string') {
    category = categoryOrLimit;
    limit = typeof maybeLimit === 'number' ? maybeLimit : 4;
  } else if (typeof categoryOrLimit === 'number') {
    limit = categoryOrLimit;
  }

  const allProducts = await getProducts();
  const current = allProducts.find(p => p.id === currentProductId);
  const targetCategory = category || (current ? current.category : 'ropa');

  return allProducts
    .filter(p => p.id !== currentProductId && p.active !== false && p.category === targetCategory)
    .slice(0, limit);
}

/**
 * LEY 3: GUARDADO A PRUEBA DE FALLOS EN FIRESTORE
 * Sube únicamente fotos nuevas con uploadProductImage en try/catch independiente.
 * Si alguna foto falla, conserva su original y escribe SIEMPRE en Firestore.
 */
export async function saveProduct(productData, onProgressCallback = null) {
  if (!productData || !productData.title) {
    throw new Error("El título de la prenda es obligatorio.");
  }

  const price = parseFloat(String(productData.price || '0').replace(',', '.')) || 0;
  const compareAtPrice = productData.compareAtPrice 
    ? (parseFloat(String(productData.compareAtPrice).replace(',', '.')) || null)
    : null;
  const weightKg = parseFloat(String(productData.weightKg || '0.35').replace(',', '.')) || 0.35;

  let id = productData.id;
  if (!id) {
    const slugBase = productData.title
      .toLowerCase()
      .trim()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    id = `${slugBase}-${Date.now().toString().slice(-4)}`;
  }

  // Recorrer imágenes protegiendo cada una en su propio bloque try/catch
  const finalImages = [];
  const rawImages = productData.images || [];

  for (let i = 0; i < rawImages.length; i++) {
    if (typeof onProgressCallback === 'function') {
      onProgressCallback(i + 1, rawImages.length, 'upload');
    }

    try {
      const url = await uploadProductImage(rawImages[i], id, i, false);
      finalImages.push(url);
    } catch (uploadErr) {
      console.warn(`[StoreService] Error subiendo imagen ${i} de "${id}", conservando original:`, uploadErr);
      finalImages.push(rawImages[i]);
    }
  }

  if (typeof onProgressCallback === 'function') {
    onProgressCallback(rawImages.length, rawImages.length, 'saving');
  }

  const cleanProduct = sanitizeForFirestore({
    ...productData,
    id,
    slug: id,
    price,
    compareAtPrice,
    weightKg,
    images: finalImages.length > 0 ? finalImages : [buildCleanStorageUrl(`products/${id}/1.webp`)],
    hasSizes: productData.hasSizes !== false,
    colors: Array.isArray(productData.colors) ? productData.colors : [],
    variants: Array.isArray(productData.variants) ? productData.variants : [{ size: 'ÚNICA', stock: 10 }],
    description: productData.description || "",
    active: productData.active !== false,
    createdAt: productData.createdAt || Date.now(),
    updatedAt: Date.now()
  });

  // Guardar SIEMPRE en Cloud Firestore
  await setDoc(doc(db, "products", cleanProduct.id), cleanProduct);

  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(DB_PRODUCTS_KEY);
      let list = raw ? JSON.parse(raw) : [];
      const idx = list.findIndex(p => p.id === cleanProduct.id);
      if (idx >= 0) {
        list[idx] = cleanProduct;
      } else {
        list.unshift(cleanProduct);
      }
      localStorage.setItem(DB_PRODUCTS_KEY, JSON.stringify(list));
    }
  } catch (e) {}

  invalidateCacheAndNotify('products_updated');
  return cleanProduct;
}

export async function deleteProduct(productId) {
  if (!productId) return false;

  try {
    // Borrar imágenes en Storage
    try {
      const folderRef = ref(storage, `products/${productId}`);
      const files = await listAll(folderRef);
      for (const item of files.items) {
        await deleteObject(item).catch(() => {});
      }
    } catch (e) {}

    // Borrar documento en Firestore
    await deleteDoc(doc(db, "products", productId));

    // Actualizar almacenamiento local
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(DB_PRODUCTS_KEY);
      if (raw) {
        let list = JSON.parse(raw);
        list = list.filter(p => p.id !== productId);
        localStorage.setItem(DB_PRODUCTS_KEY, JSON.stringify(list));
      }
    }

    invalidateCacheAndNotify('products_updated');
    return true;
  } catch (err) {
    console.error("[StoreService] Error eliminando producto:", err);
    throw err;
  }
}

export async function updateProductStockAfterOrder(orderItems) {
  if (!Array.isArray(orderItems) || orderItems.length === 0) return;

  for (const item of orderItems) {
    try {
      const prodRef = doc(db, "products", item.productId);
      const prodSnap = await getDoc(prodRef);
      if (prodSnap.exists()) {
        const prod = prodSnap.data();
        let variants = prod.variants || [];
        variants = variants.map(v => {
          if (v.size === item.size) {
            return { ...v, stock: Math.max(0, (v.stock || 0) - item.quantity) };
          }
          return v;
        });
        await updateDoc(prodRef, { variants, updatedAt: Date.now() });
      }
    } catch (e) {
      console.warn(`[StoreService] No se pudo descontar stock de ${item.productId}:`, e);
    }
  }

  invalidateCacheAndNotify('stock_updated');
}

// ============================================================================
// 5. AJUSTES DE LA TIENDA
// ============================================================================

export async function getStoreSettings(options = {}) {
  try {
    const docSnap = await getDoc(doc(db, "settings", "store_config"));
    if (docSnap.exists()) {
      return { ...MOCK_SETTINGS, ...docSnap.data() };
    }
  } catch (e) {
    console.warn("[StoreService] Firestore settings offline, usando local:", e.message);
  }

  if (typeof localStorage !== 'undefined') {
    const saved = localStorage.getItem(DB_SETTINGS_KEY);
    if (saved) {
      try { return { ...MOCK_SETTINGS, ...JSON.parse(saved) }; } catch (e) {}
    }
  }

  return { ...MOCK_SETTINGS };
}

export async function saveStoreSettings(newSettings) {
  const merged = { ...MOCK_SETTINGS, ...newSettings, updatedAt: Date.now() };

  try {
    await setDoc(doc(db, "settings", "store_config"), sanitizeForFirestore(merged));
  } catch (e) {
    console.warn("[StoreService] Firestore offline al guardar settings:", e.message);
  }

  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(DB_SETTINGS_KEY, JSON.stringify(merged));
  }

  invalidateCacheAndNotify('settings_updated');
  return merged;
}

// ============================================================================
// 6. GESTIÓN DE PEDIDOS
// ============================================================================

export async function getOrders(options = {}) {
  let orders = [];

  try {
    const snap = await getDocs(collection(db, "orders"));
    if (!snap.empty) {
      snap.forEach(d => orders.push(d.data()));
    } else {
      orders = [...INITIAL_SAMPLE_ORDERS];
    }
  } catch (e) {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem(ORDERS_STORAGE_KEY);
      if (saved) {
        try { orders = JSON.parse(saved); } catch (err) {}
      }
    }
    if (orders.length === 0) orders = [...INITIAL_SAMPLE_ORDERS];
  }

  orders.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  return orders;
}

export async function createOrder(orderData) {
  const orderNumber = orderData.orderNumber || await generateNextOrderNumber();
  const cleanOrder = sanitizeForFirestore({
    ...orderData,
    orderNumber,
    status: orderData.status || 'PAID',
    createdAt: orderData.createdAt || Date.now()
  });

  try {
    await setDoc(doc(db, "orders", cleanOrder.orderNumber), cleanOrder);
  } catch (e) {
    console.warn("[StoreService] Guardando pedido en fallback local:", e);
  }

  if (typeof localStorage !== 'undefined') {
    const raw = localStorage.getItem(ORDERS_STORAGE_KEY);
    let list = raw ? JSON.parse(raw) : [];
    list.unshift(cleanOrder);
    localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(list));
  }

  invalidateCacheAndNotify('order_created');
  return cleanOrder;
}

export async function updateOrderStatus(orderNumber, updates) {
  try {
    await updateDoc(doc(db, "orders", orderNumber), sanitizeForFirestore(updates));
  } catch (e) {
    console.warn("[StoreService] Fallback local para estado de pedido:", e);
  }

  if (typeof localStorage !== 'undefined') {
    const raw = localStorage.getItem(ORDERS_STORAGE_KEY);
    if (raw) {
      let list = JSON.parse(raw);
      list = list.map(o => (o.orderNumber === orderNumber ? { ...o, ...updates } : o));
      localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(list));
    }
  }

  invalidateCacheAndNotify('order_updated');
  return true;
}

export async function resetDatabaseToFactory() {
  await syncAllToFirestore({ forceOverwrite: true });
  await cleanLegacyOrdersInFirestore();
  invalidateCacheAndNotify('all');
  return true;
}
