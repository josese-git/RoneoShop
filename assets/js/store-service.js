/**
 * STORE SERVICE - YOANA ZAFIRO / RONEOSHOP (FASE 3.8 DEFINITIVA)
 * Motor central de datos conectado a Firebase Firestore + Firebase Storage
 * con URLs y nombres limpios (products/{id}/1.webp, 2.webp...), borrado de archivos obsoletos,
 * código de pedido español diario DD-MM-YYYY-NNN y sincronización multi-pestaña.
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
  writeBatch,
  ref,
  uploadBytes,
  uploadString,
  getDownloadURL,
  deleteObject,
  listAll,
  sanitizeForFirestore
} from './firebase-config.js';

// Claves actualizadas de almacenamiento local y caché (V3 / V7)
const CACHE_KEY = 'store_products_cache_v7';
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutos para proteger la cuota gratuita de Firebase Spark
const FIRESTORE_VERIFIED_KEY = 'firestore_verified_v2';
const DB_PRODUCTS_KEY = 'store_db_products_v3';
const DB_SETTINGS_KEY = 'store_db_settings_v3';
const ORDERS_STORAGE_KEY = 'store_orders_v2';

// Canal de difusión en tiempo real entre pestañas
const syncChannel = (typeof BroadcastChannel !== 'undefined') 
  ? new BroadcastChannel('roneoshop_live_sync') 
  : null;

/**
 * Generador de URL limpia y determinista de Firebase Storage
 * @param {string} filePath Ruta relativa en el bucket (ej. "products/abrigo-pandora/1.webp")
 * @param {string} version Opcional para forzar invalidación de caché en navegador
 */
export function buildCleanStorageUrl(filePath, version = '') {
  const bucket = firebaseConfig.storageBucket || "roneoshop-es.firebasestorage.app";
  const encodedPath = encodeURIComponent(filePath);
  const vParam = version ? `&v=${version}` : '';
  return `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodedPath}?alt=media${vParam}`;
}

/**
 * Invalida la caché de sesión, actualiza almacenamiento local y notifica a todas las pestañas
 */
export function invalidateCacheAndNotify(type = 'data_updated') {
  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem(CACHE_KEY);
    }
  } catch (e) {}

  if (syncChannel) {
    try {
      syncChannel.postMessage({ type, timestamp: Date.now() });
    } catch (e) {}
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('roneoshop:sync', { detail: { type } }));
    window.dispatchEvent(new Event('storage'));
  }
}

/**
 * Suscribe una función callback para reaccionar en vivo a cambios guardados en el admin
 */
export function onStoreDataChanged(callback) {
  if (typeof window === 'undefined') return () => {};

  const handleMessage = (e) => {
    callback(e.data || e.detail || {});
  };

  if (syncChannel) {
    syncChannel.addEventListener('message', handleMessage);
  }
  window.addEventListener('roneoshop:sync', handleMessage);
  window.addEventListener('storage', handleMessage);

  return () => {
    if (syncChannel) {
      syncChannel.removeEventListener('message', handleMessage);
    }
    window.removeEventListener('roneoshop:sync', handleMessage);
    window.removeEventListener('storage', handleMessage);
  };
}

/**
 * Configuración global de la tienda
 */
export const MOCK_SETTINGS = {
  storeName: "Yoana Zafiro",
  announcementText: "NUEVA COLECCIÓN 2026 OTOÑO & INVIERNO · ENVÍOS GRATIS A PARTIR DE 50€",
  heroBannerDesktop: "https://yoanazafiro.com/cdn/shop/files/portada.jpg?v=1737318983&width=1200",
  heroBannerMobile: "https://yoanazafiro.com/cdn/shop/files/portada.jpg?v=1737318983&width=800",
  heroTitle: "Yoana Zafiro",
  heroSubtitle: "Crea momentos inolvidables con nuestros artículos de ropa, zapatos, complementos y cuidados para la mujer.",
  shippingStandardPrice: 4.90,
  freeShippingThreshold: 50.00,
  categories: ["ropa", "cabello", "cosmetica", "peikas", "novedades", "vestidos", "abrigos", "vaqueros", "rebajas"],
  senderAddress: {
    name: "Yoana Zafiro",
    company: "Yoana Zafiro Moda S.L.",
    street: "Calle Principal 12, Planta 2",
    city: "Málaga",
    zipCode: "29001",
    province: "Málaga",
    country: "ES",
    phone: "600000000",
    email: "info@yoanazafiro.com"
  }
};

/**
 * Fuentes maestras originales para descarga y subida inicial a Storage mediante wsrv.nl
 */
export const MOCK_ORIGINAL_SOURCES = {
  "abrigo-pandora": [
    "https://cdn.shopify.com/s/files/1/0893/4391/8412/files/WhatsAppImage2026-10-26at11.52.51.jpg?v=1793029856",
    "https://images.unsplash.com/photo-1539533018447-63fcce2678e3?auto=format&fit=crop&w=900&q=80",
    "https://images.unsplash.com/photo-1544022613-e87ca75a784a?auto=format&fit=crop&w=900&q=80"
  ],
  "vaquero-faja-levis": [
    "https://cdn.shopify.com/s/files/1/0893/4391/8412/files/WhatsAppImage2026-10-20at18.44.17.jpg?v=1792619717",
    "https://images.unsplash.com/photo-1541099649105-f69ad21f3246?auto=format&fit=crop&w=900&q=80",
    "https://images.unsplash.com/photo-1582418702059-97ebafb35d09?auto=format&fit=crop&w=900&q=80"
  ],
  "pantalon-hermes": [
    "https://images.unsplash.com/photo-1551803091-e20673f15770?auto=format&fit=crop&w=900&q=80",
    "https://images.unsplash.com/photo-1509551388413-e18d0ac5d495?auto=format&fit=crop&w=900&q=80"
  ],
  "vaquero-mitos": [
    "https://images.unsplash.com/photo-1582418702059-97ebafb35d09?auto=format&fit=crop&w=900&q=80",
    "https://images.unsplash.com/photo-1541099649105-f69ad21f3246?auto=format&fit=crop&w=900&q=80"
  ],
  "camiseta-basica-blanca": [
    "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=900&q=80",
    "https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?auto=format&fit=crop&w=900&q=80"
  ],
  "conjunto-punto-milan": [
    "https://cdn.shopify.com/s/files/1/0893/4391/8412/files/WhatsAppImage2026-10-30at09.40.20.jpg?v=1793354711",
    "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=900&q=80",
    "https://images.unsplash.com/photo-1496747611176-843222e1e57c?auto=format&fit=crop&w=900&q=80"
  ],
  "vestido-boho-chic": [
    "https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?auto=format&fit=crop&w=900&q=80",
    "https://images.unsplash.com/photo-1496747611176-843222e1e57c?auto=format&fit=crop&w=900&q=80"
  ],
  "bomber-espiga-paris": [
    "https://images.unsplash.com/photo-1509631179647-0177331693ae?auto=format&fit=crop&w=900&q=80",
    "https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=900&q=80"
  ],
  "champu-nutritivo-1000ml": [
    "https://yoanazafiro.com/cdn/shop/files/ee3a1c45-86e1-4770-99e2-187ed2170cb1.jpg?v=1737629409&width=800",
    "https://images.unsplash.com/photo-1535585209827-a15fcdbc4c2d?auto=format&fit=crop&w=900&q=80"
  ],
  "secador-profesional-ionic": [
    "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=900&q=80",
    "https://images.unsplash.com/photo-1519699047748-de8e457a634e?auto=format&fit=crop&w=900&q=80"
  ],
  "pack-cosmetica-coreana-glow": [
    "https://yoanazafiro.com/cdn/shop/files/IMG_0336_15f50c3f-3300-46f6-aed0-a59d5b53c1ae.png?v=1742232271&width=800",
    "https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=900&q=80"
  ],
  "conjunto-volantes-nina-peikas": [
    "https://images.unsplash.com/photo-1518831959646-742c3a14ebf7?auto=format&fit=crop&w=900&q=80",
    "https://images.unsplash.com/photo-1503919545889-aef636e10ad4?auto=format&fit=crop&w=900&q=80"
  ]
};

/**
 * Catálogo maestro con URLs oficiales y limpias de Firebase Storage (products/{id}/1.webp, 2.webp...)
 */
export const MOCK_PRODUCTS = [
  // 1. ABRIGO PANDORA
  {
    id: "abrigo-pandora",
    slug: "abrigo-pandora",
    title: "ABRIGO PANDORA",
    category: "ropa",
    subCategory: "chaquetas",
    collectionTags: ["otono-invierno", "novedades", "abrigos"],
    price: 19.95,
    compareAtPrice: null,
    weightKg: 0.45,
    description: "Abrigo midi estructurado en tejido suave con corte recto estilizado y solapa clásica de sastre. Una prenda atemporal indispensable para temperaturas bajas.",
    hasSizes: true,
    colors: [
      { name: "Beige", hex: "#e8dfc8", inStock: false },
      { name: "Gris", hex: "#808080", inStock: false }
    ],
    images: [
      buildCleanStorageUrl("products/abrigo-pandora/1.webp"),
      buildCleanStorageUrl("products/abrigo-pandora/2.webp"),
      buildCleanStorageUrl("products/abrigo-pandora/3.webp")
    ],
    variants: [
      { size: "S", stock: 0, sku: "AB-PAN-S" },
      { size: "M", stock: 0, sku: "AB-PAN-M" },
      { size: "L", stock: 0, sku: "AB-PAN-L" }
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
    collectionTags: ["otono-invierno", "novedades", "vaqueros"],
    price: 24.95,
    compareAtPrice: null,
    weightKg: 0.50,
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
      { size: "XL", stock: 1, sku: "VF-LEV-XL" }
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
    collectionTags: ["otono-invierno", "vaqueros"],
    price: 24.95,
    compareAtPrice: null,
    weightKg: 0.52,
    description: "Denim de pierna recta clásica con lavado medio y refuerzo interior que estiliza la silueta.",
    hasSizes: true,
    colors: [
      { name: "Azul Denim", hex: "#3b5998", inStock: true }
    ],
    images: [
      buildCleanStorageUrl("products/vaquero-mitos/1.webp"),
      buildCleanStorageUrl("products/vaquero-mitos/2.webp")
    ],
    variants: [
      { size: "S", stock: 2, sku: "VA-MIT-S" },
      { size: "M", stock: 4, sku: "VA-MIT-M" },
      { size: "L", stock: 3, sku: "VA-MIT-L" },
      { size: "XL", stock: 2, sku: "VA-MIT-XL" }
    ],
    active: true,
    featured: true,
    createdAt: 1730715300000
  },

  // 5. CAMISETA BÁSICA BLANCA
  {
    id: "camiseta-basica-blanca",
    slug: "camiseta-basica-blanca",
    title: "CAMISETA BÁSICA BLANCA",
    category: "ropa",
    subCategory: "camisetas",
    collectionTags: ["primavera-verano", "novedades"],
    price: 14.25,
    compareAtPrice: null,
    weightKg: 0.18,
    description: "Camiseta de algodón peinado con escote redondo ribeteado y tacto ultrasuave. Fondo de armario imprescindible.",
    hasSizes: true,
    colors: [
      { name: "Blanco", hex: "#ffffff", inStock: true },
      { name: "Negro", hex: "#121212", inStock: true }
    ],
    images: [
      buildCleanStorageUrl("products/camiseta-basica-blanca/1.webp"),
      buildCleanStorageUrl("products/camiseta-basica-blanca/2.webp")
    ],
    variants: [
      { size: "S", stock: 6, sku: "CA-BAS-S" },
      { size: "M", stock: 8, sku: "CA-BAS-M" },
      { size: "L", stock: 5, sku: "CA-BAS-L" }
    ],
    active: true,
    featured: true,
    createdAt: 1730715400000
  },

  // 6. CONJUNTO PUNTO MILÁN (Rebaja)
  {
    id: "conjunto-punto-milan",
    slug: "conjunto-punto-milan",
    title: "CONJUNTO PUNTO MILÁN",
    category: "ropa",
    subCategory: "conjuntos",
    collectionTags: ["otono-invierno", "rebajas"],
    price: 32.95,
    compareAtPrice: 42.00,
    weightKg: 0.60,
    description: "Dos piezas de punto fino con textura acanalada formado por jersey de cuello perkins y pantalón culotte a juego.",
    hasSizes: true,
    colors: [
      { name: "Camel", hex: "#c19a6b", inStock: true },
      { name: "Negro", hex: "#121212", inStock: true }
    ],
    images: [
      buildCleanStorageUrl("products/conjunto-punto-milan/1.webp"),
      buildCleanStorageUrl("products/conjunto-punto-milan/2.webp"),
      buildCleanStorageUrl("products/conjunto-punto-milan/3.webp")
    ],
    variants: [
      { size: "S", stock: 3, sku: "CO-MIL-S" },
      { size: "M", stock: 5, sku: "CO-MIL-M" },
      { size: "L", stock: 2, sku: "CO-MIL-L" }
    ],
    active: true,
    featured: true,
    createdAt: 1730715500000
  },

  // 7. VESTIDO BOHO CHIC (Rebaja)
  {
    id: "vestido-boho-chic",
    slug: "vestido-boho-chic",
    title: "VESTIDO BOHO CHIC",
    category: "ropa",
    subCategory: "vestidos",
    collectionTags: ["primavera-verano", "rebajas", "vestidos"],
    price: 26.50,
    compareAtPrice: 35.00,
    weightKg: 0.38,
    description: "Vestido midi con estampado floral étnico, mangas abullonadas y cintura con lazada regulable para máxima feminidad.",
    hasSizes: true,
    colors: [
      { name: "Marrón Teja", hex: "#8b4513", inStock: true }
    ],
    images: [
      buildCleanStorageUrl("products/vestido-boho-chic/1.webp"),
      buildCleanStorageUrl("products/vestido-boho-chic/2.webp")
    ],
    variants: [
      { size: "S", stock: 2, sku: "VE-BOH-S" },
      { size: "M", stock: 4, sku: "VE-BOH-M" },
      { size: "L", stock: 1, sku: "VE-BOH-L" }
    ],
    active: true,
    featured: true,
    createdAt: 1730715600000
  },

  // 8. BOMBER ESPIGA PARIS
  {
    id: "bomber-espiga-paris",
    slug: "bomber-espiga-paris",
    title: "BOMBER ESPIGA PARÍS",
    category: "ropa",
    subCategory: "chaquetas",
    collectionTags: ["otono-invierno", "abrigos"],
    price: 28.95,
    compareAtPrice: null,
    weightKg: 0.55,
    description: "Cazadora bomber oversize en jacquard espiga con cremallera frontal metálica y acabados elásticos en canalé.",
    hasSizes: true,
    colors: [
      { name: "Negro", hex: "#121212", inStock: true },
      { name: "Blanco", hex: "#ffffff", inStock: true }
    ],
    images: [
      buildCleanStorageUrl("products/bomber-espiga-paris/1.webp"),
      buildCleanStorageUrl("products/bomber-espiga-paris/2.webp")
    ],
    variants: [
      { size: "S", stock: 1, sku: "BO-ESP-S" },
      { size: "M", stock: 3, sku: "BO-ESP-M" }
    ],
    active: true,
    featured: true,
    createdAt: 1730715700000
  },

  // 9. CHAMPÚ NUTRITIVO 1000ML (Talla Única)
  {
    id: "champu-nutritivo-1000ml",
    slug: "champu-nutritivo-1000ml",
    title: "CHAMPÚ NUTRITIVO 1000ML",
    category: "cabello",
    subCategory: "champu",
    collectionTags: ["cabello", "tratamiento-capilar"],
    price: 18.00,
    compareAtPrice: null,
    weightKg: 1.05,
    description: "Tratamiento capilar intensivo en formato salón de 1000ml con aminoácidos y proteínas de seda.",
    hasSizes: false,
    colors: [],
    images: [
      buildCleanStorageUrl("products/champu-nutritivo-1000ml/1.webp"),
      buildCleanStorageUrl("products/champu-nutritivo-1000ml/2.webp")
    ],
    variants: [
      { size: "ÚNICA", stock: 0, sku: "CH-NUT-1L" }
    ],
    active: true,
    featured: true,
    createdAt: 1730715800000
  },

  // 10. SECADOR PROFESIONAL IONIC (Talla Única)
  {
    id: "secador-profesional-ionic",
    slug: "secador-profesional-ionic",
    title: "SECADOR PROFESIONAL IONIC",
    category: "cabello",
    subCategory: "accesorios",
    collectionTags: ["cabello"],
    price: 54.95,
    compareAtPrice: null,
    weightKg: 0.78,
    description: "Secador con motor digital de 2200W y tecnología dual iónica para un acabado brillante sin encrespamiento.",
    hasSizes: false,
    colors: [
      { name: "Negro", hex: "#121212", inStock: true }
    ],
    images: [
      buildCleanStorageUrl("products/secador-profesional-ionic/1.webp"),
      buildCleanStorageUrl("products/secador-profesional-ionic/2.webp")
    ],
    variants: [
      { size: "ÚNICA", stock: 5, sku: "SEC-PRO-ION" }
    ],
    active: true,
    featured: true,
    createdAt: 1730715900000
  },

  // 11. PACK COSMÉTICA COREANA SOME BY MI (Rebaja - Talla Única)
  {
    id: "pack-cosmetica-coreana-glow",
    slug: "pack-cosmetica-coreana-glow",
    title: "PACK COSMÉTICA COREANA SOME BY MI",
    category: "cosmetica",
    subCategory: "tratamiento",
    collectionTags: ["cosmetica", "rebajas", "novedades"],
    price: 39.95,
    compareAtPrice: 48.00,
    weightKg: 0.65,
    description: "Rutina facial completa de 4 pasos con Centella Asiática, Árbol del Té y AHA-BHA-PHA para efecto Glass Skin.",
    hasSizes: false,
    colors: [],
    images: [
      buildCleanStorageUrl("products/pack-cosmetica-coreana-glow/1.webp"),
      buildCleanStorageUrl("products/pack-cosmetica-coreana-glow/2.webp")
    ],
    variants: [
      { size: "ÚNICA", stock: 3, sku: "PACK-K-SOME" }
    ],
    active: true,
    featured: true,
    createdAt: 1730716000000
  },

  // 12. CONJUNTO VOLANTES NIÑA PEIKAS
  {
    id: "conjunto-volantes-nina-peikas",
    slug: "conjunto-volantes-nina-peikas",
    title: "CONJUNTO VOLANTES NIÑA PEIKAS",
    category: "peikas",
    subCategory: "accesorios",
    collectionTags: ["peikas", "novedades", "primavera-verano"],
    price: 22.95,
    compareAtPrice: null,
    weightKg: 0.28,
    description: "Conjunto infantil de blusa y cubrepañal con volantes calados confeccionado en algodón pima hipoalergénico.",
    hasSizes: true,
    colors: [
      { name: "Rosa", hex: "#f4c2c2", inStock: true }
    ],
    images: [
      buildCleanStorageUrl("products/conjunto-volantes-nina-peikas/1.webp"),
      buildCleanStorageUrl("products/conjunto-volantes-nina-peikas/2.webp")
    ],
    variants: [
      { size: "3M", stock: 3, sku: "PEI-VOL-3M" },
      { size: "6M", stock: 4, sku: "PEI-VOL-6M" },
      { size: "12M", stock: 2, sku: "PEI-VOL-12M" }
    ],
    active: true,
    featured: true,
    createdAt: 1730716100000
  }
];

// Pedidos de prueba iniciales con el nuevo formato oficial DD-MM-YYYY-NNN
export const INITIAL_SAMPLE_ORDERS = [
  {
    orderNumber: "05-11-2026-001",
    createdAt: Date.now() - 3600 * 1000 * 2,
    customer: {
      firstName: "María",
      lastName: "García López",
      email: "maria.garcia@gmail.com",
      phone: "611223344",
      street: "Calle Larios 4, 3ºB",
      city: "Málaga",
      zipCode: "29015",
      province: "Málaga",
      country: "ES"
    },
    items: [
      {
        productId: "vaquero-faja-levis",
        title: "VAQUERO FAJA LEVIS",
        size: "M",
        price: 24.95,
        quantity: 1,
        image: buildCleanStorageUrl("products/vaquero-faja-levis/1.webp")
      }
    ],
    subtotal: 24.95,
    shippingCost: 4.90,
    total: 29.85,
    paymentMethod: "BIZUM",
    status: "PAID",
    packlink: {
      synced: false,
      reference: null
    },
    totalWeightKg: 0.50
  },
  {
    orderNumber: "05-11-2026-002",
    createdAt: Date.now() - 3600 * 1000 * 24,
    customer: {
      firstName: "Carmen",
      lastName: "Navarro Ruiz",
      email: "carmen.navarro@hotmail.com",
      phone: "655998877",
      street: "Gran Vía 32, 5ºA",
      city: "Madrid",
      zipCode: "28013",
      province: "Madrid",
      country: "ES"
    },
    items: [
      {
        productId: "conjunto-punto-milan",
        title: "CONJUNTO PUNTO MILÁN",
        size: "S",
        price: 32.95,
        quantity: 1,
        image: buildCleanStorageUrl("products/conjunto-punto-milan/1.webp")
      },
      {
        productId: "camiseta-basica-blanca",
        title: "CAMISETA BÁSICA BLANCA",
        size: "M",
        price: 14.25,
        quantity: 2,
        image: buildCleanStorageUrl("products/camiseta-basica-blanca/1.webp")
      }
    ],
    subtotal: 61.45,
    shippingCost: 0.00,
    total: 61.45,
    paymentMethod: "CARD",
    status: "PAID",
    packlink: {
      synced: true,
      reference: "ES2026PRO918234",
      trackingUrl: "https://pro.packlink.es/private/shipments"
    },
    totalWeightKg: 0.96
  }
];

/**
 * Purga de almacenamiento antiguo en localStorage y sessionStorage
 */
function purgeLegacyCaches() {
  try {
    if (typeof localStorage !== 'undefined') {
      ['store_db_products_v1', 'store_db_products_v2', 'store_db_settings_v1', 'store_db_settings_v2', 'store_orders_v1'].forEach(k => localStorage.removeItem(k));
    }
    if (typeof sessionStorage !== 'undefined') {
      ['store_products_cache_v4', 'store_products_cache_v5', 'store_products_cache_v6', 'firestore_verified_v1'].forEach(k => sessionStorage.removeItem(k));
    }
  } catch (e) {}
}
purgeLegacyCaches();

/**
 * Inicializa la base de datos local con datos semilla si no existen
 */
function initLocalDatabase() {
  try {
    if (typeof localStorage === 'undefined' || typeof localStorage.getItem !== 'function') return;
    if (!localStorage.getItem(DB_PRODUCTS_KEY)) {
      localStorage.setItem(DB_PRODUCTS_KEY, JSON.stringify(MOCK_PRODUCTS));
    }
    if (!localStorage.getItem(DB_SETTINGS_KEY)) {
      localStorage.setItem(DB_SETTINGS_KEY, JSON.stringify(MOCK_SETTINGS));
    }
    if (!localStorage.getItem(ORDERS_STORAGE_KEY)) {
      localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(INITIAL_SAMPLE_ORDERS));
    }
  } catch (e) {
    console.warn("[StoreService] Error inicializando localStorage:", e);
  }
}
initLocalDatabase();

/**
 * Convierte de forma infalible cualquier origen de imagen (File, Blob, DataURL o URL externa)
 * a un Blob con formato WebP nativo
 */
export async function imageSourceToWebpBlob(source, maxHeight = 1100, quality = 0.84) {
  if (!source) throw new Error("Origen de imagen vacío");

  if (typeof document === 'undefined' || typeof window === 'undefined') {
    return new Blob([], { type: 'image/webp' });
  }

  let objectUrl = null;

  try {
    const imgElement = new Image();
    imgElement.crossOrigin = "anonymous";

    if (source instanceof File || source instanceof Blob) {
      objectUrl = URL.createObjectURL(source);
      await new Promise((res, rej) => {
        imgElement.onload = res;
        imgElement.onerror = rej;
        imgElement.src = objectUrl;
      });
    } else if (typeof source === 'string' && source.startsWith('data:image')) {
      await new Promise((res, rej) => {
        imgElement.onload = res;
        imgElement.onerror = rej;
        imgElement.src = source;
      });
    } else if (typeof source === 'string' && source.startsWith('http')) {
      // Para URLs externas (cdn.shopify.com, unsplash, etc.) pasamos siempre por proxy CORS wsrv.nl
      const proxyUrl = `https://wsrv.nl/?url=${encodeURIComponent(source)}&h=${maxHeight}&output=webp&q=${Math.round(quality * 100)}`;
      const response = await fetch(proxyUrl, { mode: 'cors' });
      if (!response.ok) throw new Error(`Proxy fetch falló con status ${response.status}`);
      const webpBlob = await response.blob();
      return webpBlob;
    } else {
      throw new Error("Formato de imagen no soportado");
    }

    // Redimensionado proporcional en canvas para File / Blob / DataURL
    let width = imgElement.naturalWidth || imgElement.width || 800;
    let height = imgElement.naturalHeight || imgElement.height || 1000;

    if (height > maxHeight) {
      width = Math.round((width * maxHeight) / height);
      height = maxHeight;
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    ctx.drawImage(imgElement, 0, 0, width, height);

    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob(b => (b ? resolve(b) : reject(new Error("Error toBlob"))), 'image/webp', quality);
    });

    return blob;
  } finally {
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
    }
  }
}

/**
 * Sube una imagen a Firebase Storage con nombre limpio determinista (1.webp, 2.webp...)
 * y devuelve la URL limpia sin tokens innecesarios
 */
export async function uploadProductImage(imageSource, productId, index = 0, forceReupload = false) {
  const cleanFileName = `${index + 1}.webp`;
  const filePath = `products/${productId}/${cleanFileName}`;

  // Si ya es una URL limpia de nuestro Firebase Storage y no forzamos resubida, conservarla
  if (
    !forceReupload &&
    typeof imageSource === 'string' &&
    imageSource.includes('firebasestorage.googleapis.com') &&
    !imageSource.includes('foto_') &&
    !imageSource.includes('img_')
  ) {
    return imageSource;
  }

  const webpBlob = await imageSourceToWebpBlob(imageSource);
  const storageRef = ref(storage, filePath);
  
  await uploadBytes(storageRef, webpBlob, {
    contentType: 'image/webp',
    cacheControl: 'public,max-age=31536000'
  });

  return buildCleanStorageUrl(filePath, Date.now().toString().slice(-4));
}

/**
 * Migra todas las imágenes externas y nombres antiguos a Firebase Storage con nombres 1.webp, 2.webp...
 * y elimina los archivos viejos foto_ del bucket
 */
export async function migrateAllImagesToFirebaseStorage(onProgressCallback) {
  try {
    const snap = await getDocs(collection(db, "products"));
    const allProducts = [];
    let totalImagesToMigrate = 0;

    snap.forEach(docSnap => {
      const p = { id: docSnap.id, ...docSnap.data() };
      allProducts.push(p);
      const images = p.images || [];
      const dirtyCount = images.filter(img => 
        typeof img !== 'string' ||
        !img.includes('firebasestorage.googleapis.com') ||
        img.includes('foto_') ||
        img.includes('img_') ||
        img.includes('cdn.shopify.com') ||
        img.includes('unsplash.com')
      ).length;
      totalImagesToMigrate += dirtyCount;
    });

    console.info(`[Migrate] Detectadas ${totalImagesToMigrate} fotos a normalizar en Storage...`);
    let currentProcessed = 0;

    for (const product of allProducts) {
      // 1. Limpiar archivos antiguos foto_ o img_ dentro de la carpeta de la prenda
      try {
        const folderRef = ref(storage, `products/${product.id}`);
        const listResult = await listAll(folderRef);
        for (const itemRef of listResult.items) {
          if (itemRef.name.startsWith('foto_') || itemRef.name.startsWith('img_')) {
            await deleteObject(itemRef).catch(() => {});
          }
        }
      } catch (listErr) {}

      // 2. Determinar fuentes de imágenes (preferir originales si la actual falló en migraciones previas)
      const currentImgs = product.images || [];
      const originalSources = MOCK_ORIGINAL_SOURCES[product.id] || currentImgs;
      const count = Math.max(currentImgs.length, originalSources.length);
      const newCleanUrls = [];
      let productModified = false;

      for (let i = 0; i < count; i++) {
        const sourceUrl = originalSources[i] || currentImgs[i];
        if (!sourceUrl) continue;

        // Si ya es limpia y definitiva
        if (
          typeof sourceUrl === 'string' &&
          sourceUrl.includes('firebasestorage.googleapis.com') &&
          !sourceUrl.includes('foto_') &&
          !sourceUrl.includes('img_')
        ) {
          newCleanUrls.push(sourceUrl);
          continue;
        }

        currentProcessed++;
        if (typeof onProgressCallback === 'function') {
          onProgressCallback({
            productTitle: product.title,
            current: currentProcessed,
            total: Math.max(totalImagesToMigrate, currentProcessed)
          });
        }

        try {
          const cleanUploadedUrl = await uploadProductImage(sourceUrl, product.id, i, true);
          newCleanUrls.push(cleanUploadedUrl);
          productModified = true;
        } catch (uploadErr) {
          console.error(`[Migrate] Error subiendo imagen ${i} de "${product.title}":`, uploadErr);
          newCleanUrls.push(buildCleanStorageUrl(`products/${product.id}/${i + 1}.webp`));
        }
      }

      if (productModified || newCleanUrls.length > 0) {
        product.images = newCleanUrls;
        product.updatedAt = Date.now();
        await setDoc(doc(db, "products", product.id), sanitizeForFirestore(product), { merge: true });
      }
    }

    // Refrescar caché local
    const finalSnap = await getDocs(collection(db, "products"));
    const finalProducts = [];
    finalSnap.forEach(d => finalProducts.push({ id: d.id, ...d.data() }));
    finalProducts.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    saveProductsToLocalAndCache(finalProducts);

    invalidateCacheAndNotify('images_migrated');
    return { ok: true, migratedCount: currentProcessed, totalImages: totalImagesToMigrate };

  } catch (err) {
    console.error("[Migrate] Error general en migración de imágenes:", err);
    return { ok: false, migratedCount: 0, totalImages: 0, error: err?.message || String(err) };
  }
}

/**
 * Limpia pedidos antiguos que no sigan el formato DD-MM-YYYY-NNN
 */
export async function cleanLegacyOrdersInFirestore() {
  try {
    const snap = await getDocs(collection(db, "orders"));
    const orderFormatRegex = /^\d{2}-\d{2}-\d{4}-\d{3}$/;

    for (const docSnap of snap.docs) {
      if (!orderFormatRegex.test(docSnap.id)) {
        console.info(`[CleanOrders] Eliminando pedido con formato antiguo: ${docSnap.id}`);
        await deleteDoc(doc(db, "orders", docSnap.id)).catch(() => {});
      }
    }

    // Si la colección quedó vacía, sembrar los 2 pedidos iniciales
    const checkSnap = await getDocs(collection(db, "orders"));
    if (checkSnap.empty) {
      for (const ord of INITIAL_SAMPLE_ORDERS) {
        await setDoc(doc(db, "orders", ord.orderNumber), sanitizeForFirestore(ord));
      }
    }
  } catch (e) {
    console.warn("[CleanOrders] Error limpiando pedidos antiguos:", e);
  }
}

/**
 * Genera el siguiente número de pedido oficial diario con formato DD-MM-YYYY-NNN (ej. 05-11-2026-001)
 */
export async function generateNextOrderNumber(dateObj = new Date()) {
  const dd = String(dateObj.getDate()).padStart(2, '0');
  const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
  const yyyy = dateObj.getFullYear();
  const datePrefix = `${dd}-${mm}-${yyyy}-`;

  const existingOrders = await getOrders({ forceRefresh: true });
  let maxSeq = 0;

  existingOrders.forEach(o => {
    if (o.orderNumber && String(o.orderNumber).startsWith(datePrefix)) {
      const parts = String(o.orderNumber).split('-');
      const seq = parseInt(parts[3], 10);
      if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
    }
  });

  const nextSeq = String(maxSeq + 1).padStart(3, '0');
  return `${datePrefix}${nextSeq}`;
}

/**
 * Sincroniza atómicamente todos los productos, ajustes y pedidos en Firebase Firestore mediante writeBatch
 */
export async function syncAllToFirestore({ forceOverwrite = false } = {}) {
  try {
    const snap = await getDocs(collection(db, "products"));

    if (snap.empty || forceOverwrite) {
      console.info("[StoreService] Sincronizando catálogo con writeBatch...");
      
      let products = MOCK_PRODUCTS;
      try {
        if (typeof localStorage !== 'undefined') {
          const rawP = localStorage.getItem(DB_PRODUCTS_KEY);
          if (rawP) products = JSON.parse(rawP);
        }
      } catch (e) {}

      let settings = MOCK_SETTINGS;
      try {
        if (typeof localStorage !== 'undefined') {
          const rawS = localStorage.getItem(DB_SETTINGS_KEY);
          if (rawS) settings = JSON.parse(rawS);
        }
      } catch (e) {}

      let orders = INITIAL_SAMPLE_ORDERS;
      try {
        if (typeof localStorage !== 'undefined') {
          const rawO = localStorage.getItem(ORDERS_STORAGE_KEY);
          if (rawO) orders = JSON.parse(rawO);
        }
      } catch (e) {}

      const batch = writeBatch(db);

      for (const p of products) {
        const cleanP = sanitizeForFirestore(p);
        batch.set(doc(db, "products", String(cleanP.id)), cleanP);
      }

      batch.set(doc(db, "settings", "store_config"), sanitizeForFirestore(settings));

      for (const order of orders) {
        const cleanOrder = sanitizeForFirestore(order);
        batch.set(doc(db, "orders", String(cleanOrder.orderNumber)), cleanOrder);
      }

      await batch.commit();

      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem(FIRESTORE_VERIFIED_KEY, 'true');
      }
    }

    // Limpiar pedidos legacy
    await cleanLegacyOrdersInFirestore();

    const verifySnap = await getDocs(collection(db, "products"));
    const count = verifySnap.size;

    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(FIRESTORE_VERIFIED_KEY, 'true');
    }

    return { ok: true, count };

  } catch (err) {
    console.error("[FIRESTORE ERROR CRÍTICO]:", err);
    return {
      ok: false,
      errorCode: err.code || 'unknown',
      errorMessage: err.message || String(err)
    };
  }
}

/**
 * Obtiene todos los productos del catálogo con auto-seed verificado en Firestore y caché
 */
export async function getProducts({ forceRefresh = false } = {}) {
  const isVerifiedInSession = (typeof sessionStorage !== 'undefined') 
    && sessionStorage.getItem(FIRESTORE_VERIFIED_KEY) === 'true';

  if (!forceRefresh && isVerifiedInSession) {
    try {
      if (typeof sessionStorage !== 'undefined') {
        const cached = sessionStorage.getItem(CACHE_KEY);
        if (cached) {
          const { data, timestamp } = JSON.parse(cached);
          if (Date.now() - timestamp < CACHE_TTL_MS && Array.isArray(data) && data.length > 0) {
            return data;
          }
        }
      }
    } catch (e) {}
  }

  try {
    const productsColl = collection(db, "products");
    const snapshot = await getDocs(productsColl);

    if (!snapshot.empty) {
      const cloudProducts = [];
      snapshot.forEach(docSnap => {
        cloudProducts.push({ id: docSnap.id, ...docSnap.data() });
      });

      cloudProducts.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

      saveProductsToLocalAndCache(cloudProducts);
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem(FIRESTORE_VERIFIED_KEY, 'true');
      }
      return cloudProducts;
    }

    const syncRes = await syncAllToFirestore({ forceOverwrite: true });
    if (syncRes.ok) {
      saveProductsToLocalAndCache(MOCK_PRODUCTS);
      return MOCK_PRODUCTS;
    }

  } catch (err) {
    console.warn("[StoreService] Error accediendo a Firestore, usando fallback local:", err?.message || err);
  }

  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(DB_PRODUCTS_KEY);
      if (raw) {
        const localProducts = JSON.parse(raw);
        if (Array.isArray(localProducts) && localProducts.length > 0) {
          return localProducts;
        }
      }
    }
  } catch (e) {}

  return MOCK_PRODUCTS;
}

function saveProductsToLocalAndCache(products) {
  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(CACHE_KEY, JSON.stringify({
        data: products,
        timestamp: Date.now()
      }));
    }
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(DB_PRODUCTS_KEY, JSON.stringify(products));
    }
  } catch (e) {}
}

/**
 * Obtiene un producto por su id o su slug
 */
export async function getProductByIdOrSlug(idOrSlug) {
  if (!idOrSlug) return null;
  const products = await getProducts();
  const search = String(idOrSlug).toLowerCase().trim();
  return products.find(p => p.id.toLowerCase() === search || (p.slug && p.slug.toLowerCase() === search)) || null;
}

/**
 * Filtra y ordena los productos
 */
export async function getProductsByFilter({
  category = 'todos',
  search = '',
  onlyInStock = false,
  size = null,
  minPrice = null,
  maxPrice = null,
  sortBy = 'featured'
} = {}) {
  let products = await getProducts();

  if (category && category !== 'todos') {
    const catLow = category.toLowerCase().trim();
    products = products.filter(p => {
      const pCat = (p.category || '').toLowerCase();
      const pSub = (p.subCategory || '').toLowerCase();
      const pTags = (p.collectionTags || []).map(t => t.toLowerCase());
      return pCat === catLow || pSub === catLow || pTags.includes(catLow);
    });
  }

  if (search && search.trim() !== '') {
    const q = search.toLowerCase().trim();
    products = products.filter(p => {
      return (p.title || '').toLowerCase().includes(q) ||
             (p.description || '').toLowerCase().includes(q) ||
             (p.subCategory || '').toLowerCase().includes(q);
    });
  }

  if (onlyInStock) {
    products = products.filter(p => {
      const stock = p.variants ? p.variants.reduce((acc, v) => acc + (v.stock || 0), 0) : 0;
      return stock > 0;
    });
  }

  if (size) {
    products = products.filter(p => {
      return p.variants && p.variants.some(v => v.size.toUpperCase() === size.toUpperCase() && v.stock > 0);
    });
  }

  if (minPrice !== null) {
    products = products.filter(p => p.price >= minPrice);
  }
  if (maxPrice !== null) {
    products = products.filter(p => p.price <= maxPrice);
  }

  const sorted = [...products];
  switch (sortBy) {
    case 'price-asc':
      sorted.sort((a, b) => a.price - b.price);
      break;
    case 'price-desc':
      sorted.sort((a, b) => b.price - a.price);
      break;
    case 'newest':
      sorted.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      break;
    case 'featured':
    default:
      sorted.sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0));
      break;
  }

  return sorted;
}

/**
 * Productos relacionados
 */
export async function getRelatedProducts(productId, limit = 4) {
  const all = await getProducts();
  const current = all.find(p => p.id === productId);
  if (!current) return all.slice(0, limit);

  const related = all.filter(p => p.id !== productId && p.category === current.category);
  if (related.length >= limit) return related.slice(0, limit);

  const others = all.filter(p => p.id !== productId && p.category !== current.category);
  return [...related, ...others].slice(0, limit);
}

/**
 * Guarda o actualiza una prenda en Firestore y Storage, sincronizando con local
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

  // Subir imágenes con nombres limpios (1.webp, 2.webp...)
  const finalImages = [];
  const rawImages = productData.images || [];
  for (let i = 0; i < rawImages.length; i++) {
    if (typeof onProgressCallback === 'function') {
      onProgressCallback(i + 1, rawImages.length, 'upload');
    }
    const cleanUrl = await uploadProductImage(rawImages[i], id, i);
    finalImages.push(cleanUrl);
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

/**
 * Elimina una prenda de Firestore y sus fotos de Storage
 */
export async function deleteProduct(productId) {
  if (!productId) return false;

  await deleteDoc(doc(db, "products", productId));

  try {
    const folderRef = ref(storage, `products/${productId}`);
    const listResult = await listAll(folderRef);
    for (const item of listResult.items) {
      await deleteObject(item).catch(() => {});
    }
  } catch (e) {}

  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(DB_PRODUCTS_KEY);
      if (raw) {
        let list = JSON.parse(raw);
        list = list.filter(p => p.id !== productId);
        localStorage.setItem(DB_PRODUCTS_KEY, JSON.stringify(list));
      }
    }
  } catch (e) {}

  invalidateCacheAndNotify('products_updated');
  return true;
}

/**
 * Descuenta el stock tras una compra confirmada
 */
export async function updateProductStockAfterOrder(orderItems) {
  if (!Array.isArray(orderItems) || orderItems.length === 0) return;

  const products = await getProducts({ forceRefresh: true });

  for (const item of orderItems) {
    const prod = products.find(p => p.id === item.productId);
    if (!prod || !prod.variants) continue;

    const variant = prod.variants.find(v => v.size.toUpperCase() === String(item.size).toUpperCase());
    if (variant) {
      variant.stock = Math.max(0, (variant.stock || 0) - (item.quantity || 1));
      
      try {
        await setDoc(doc(db, "products", prod.id), sanitizeForFirestore(prod), { merge: true });
      } catch (e) {
        console.warn("[StoreService] Error actualizando stock en Firestore:", e);
      }
    }
  }

  saveProductsToLocalAndCache(products);
  invalidateCacheAndNotify('stock_updated');
}

/**
 * Obtiene la configuración de la tienda
 */
export async function getStoreSettings() {
  try {
    const settingsDoc = await getDoc(doc(db, "settings", "store_config"));
    if (settingsDoc.exists()) {
      return { ...MOCK_SETTINGS, ...settingsDoc.data() };
    }
  } catch (e) {
    console.warn("[StoreService] Error leyendo settings de Firestore, usando local:", e?.message || e);
  }

  try {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem(DB_SETTINGS_KEY);
      if (saved) return JSON.parse(saved);
    }
  } catch (e) {}

  return MOCK_SETTINGS;
}

/**
 * Guarda la configuración de la tienda
 */
export async function saveStoreSettings(settings) {
  const merged = sanitizeForFirestore({ ...MOCK_SETTINGS, ...settings, updatedAt: Date.now() });

  await setDoc(doc(db, "settings", "store_config"), merged, { merge: true });

  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(DB_SETTINGS_KEY, JSON.stringify(merged));
    }
  } catch (e) {}

  invalidateCacheAndNotify('settings_updated');
  return merged;
}

/**
 * Obtiene el listado de pedidos
 */
export async function getOrders({ forceRefresh = false } = {}) {
  try {
    const snap = await getDocs(collection(db, "orders"));
    if (!snap.empty) {
      const orders = [];
      snap.forEach(d => orders.push(d.data()));
      orders.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      return orders;
    }
  } catch (e) {
    console.warn("[StoreService] Error leyendo pedidos de Firestore:", e?.message || e);
  }

  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(ORDERS_STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    }
  } catch (e) {}

  return INITIAL_SAMPLE_ORDERS;
}

/**
 * Registra un nuevo pedido completado con código DD-MM-YYYY-NNN
 */
export async function createOrder(orderData) {
  let orderNumber = orderData.orderNumber;
  if (!orderNumber || !/^\d{2}-\d{2}-\d{4}-\d{3}$/.test(orderNumber)) {
    orderNumber = await generateNextOrderNumber();
  }

  const cleanOrder = sanitizeForFirestore({
    ...orderData,
    orderNumber,
    redsysOrderId: orderNumber.replace(/-/g, '')
  });

  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(ORDERS_STORAGE_KEY);
      const orders = raw ? JSON.parse(raw) : [];
      orders.unshift(cleanOrder);
      localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(orders));
    }
  } catch (e) {}

  await setDoc(doc(db, "orders", String(cleanOrder.orderNumber)), cleanOrder);

  invalidateCacheAndNotify('order_created');
  return cleanOrder;
}

/**
 * Actualiza el estado o seguimiento Packlink de un pedido
 */
export async function updateOrderStatus(orderNumber, updates) {
  const cleanUpdates = sanitizeForFirestore({ ...updates, updatedAt: Date.now() });

  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(ORDERS_STORAGE_KEY);
      if (raw) {
        const orders = JSON.parse(raw);
        const idx = orders.findIndex(o => o.orderNumber === orderNumber);
        if (idx >= 0) {
          orders[idx] = { ...orders[idx], ...cleanUpdates };
          localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(orders));
        }
      }
    }
  } catch (e) {}

  await setDoc(doc(db, "orders", String(orderNumber)), cleanUpdates, { merge: true });

  invalidateCacheAndNotify('order_updated');
  return true;
}

/**
 * Restaura la base de datos a los valores de fábrica
 */
export async function resetDatabaseToFactory() {
  purgeLegacyCaches();
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(DB_PRODUCTS_KEY, JSON.stringify(MOCK_PRODUCTS));
      localStorage.setItem(DB_SETTINGS_KEY, JSON.stringify(MOCK_SETTINGS));
      localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(INITIAL_SAMPLE_ORDERS));
    }
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem(CACHE_KEY);
      sessionStorage.removeItem(FIRESTORE_VERIFIED_KEY);
    }
  } catch (e) {}

  await syncAllToFirestore({ forceOverwrite: true });
  await migrateAllImagesToFirebaseStorage();

  invalidateCacheAndNotify('factory_reset');
  return true;
}
