/**
 * STORE SERVICE - YOANA ZAFIRO / RONEOSHOP (FASE 3.5 DEFINITIVA)
 * Motor central de datos conectado a Firebase Firestore + Firebase Storage
 * con subida por lotes atómica (writeBatch), auto-seed verificado, compresión .webp
 * y sincronización instantánea multi-pestaña mediante BroadcastChannel('roneoshop_live_sync').
 */

import {
  db,
  storage,
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
  sanitizeForFirestore
} from './firebase-config.js';

// Claves de almacenamiento local y caché
const CACHE_KEY = 'store_products_cache_v6';
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutos para proteger la cuota gratuita de Firebase Spark
const FIRESTORE_VERIFIED_KEY = 'firestore_verified_v1';
const DB_PRODUCTS_KEY = 'store_db_products_v2';
const DB_SETTINGS_KEY = 'store_db_settings_v2';
const ORDERS_STORAGE_KEY = 'store_orders_v1';

// Canal de difusión en tiempo real entre pestañas
const syncChannel = (typeof BroadcastChannel !== 'undefined') 
  ? new BroadcastChannel('roneoshop_live_sync') 
  : null;

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
 * @param {Function} callback
 * @returns {Function} Función para cancelar la suscripción
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
 * Configuración global por defecto de la tienda
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
 * Catálogo maestro inicial con datos exactos del catálogo y PDF de Yoana Zafiro
 * Esquema limpio: sin composition, con colors, hasSizes y description
 */
export const MOCK_PRODUCTS = [
  // 1. ABRIGO PANDORA (Clon exacto PDF oficial - Agotado)
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
      "https://cdn.shopify.com/s/files/1/0893/4391/8412/files/WhatsAppImage2026-10-26at11.52.51.jpg?v=1793029856",
      "https://images.unsplash.com/photo-1539533018447-63fcce2678e3?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1544022613-e87ca75a784a?auto=format&fit=crop&w=900&q=80"
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
      "https://cdn.shopify.com/s/files/1/0893/4391/8412/files/WhatsAppImage2026-10-20at18.44.17.jpg?v=1792619717",
      "https://images.unsplash.com/photo-1541099649105-f69ad21f3246?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1582418702059-97ebafb35d09?auto=format&fit=crop&w=900&q=80"
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
      "https://images.unsplash.com/photo-1551803091-e20673f15770?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1509551388413-e18d0ac5d495?auto=format&fit=crop&w=900&q=80"
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
      "https://images.unsplash.com/photo-1582418702059-97ebafb35d09?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1541099649105-f69ad21f3246?auto=format&fit=crop&w=900&q=80"
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
      "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?auto=format&fit=crop&w=900&q=80"
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
      "https://cdn.shopify.com/s/files/1/0893/4391/8412/files/WhatsAppImage2026-10-30at09.40.20.jpg?v=1793354711",
      "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1496747611176-843222e1e57c?auto=format&fit=crop&w=900&q=80"
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
      "https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1496747611176-843222e1e57c?auto=format&fit=crop&w=900&q=80"
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
      "https://images.unsplash.com/photo-1509631179647-0177331693ae?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=900&q=80"
    ],
    variants: [
      { size: "S", stock: 1, sku: "BO-ESP-S" },
      { size: "M", stock: 3, sku: "BO-ESP-M" }
    ],
    active: true,
    featured: true,
    createdAt: 1730715700000
  },

  // 9. CHAMPÚ NUTRITIVO 1000ML (Agotado - Talla Única)
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
      "https://yoanazafiro.com/cdn/shop/files/ee3a1c45-86e1-4770-99e2-187ed2170cb1.jpg?v=1737629409&width=800",
      "https://images.unsplash.com/photo-1535585209827-a15fcdbc4c2d?auto=format&fit=crop&w=900&q=80"
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
      "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1519699047748-de8e457a634e?auto=format&fit=crop&w=900&q=80"
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
      "https://yoanazafiro.com/cdn/shop/files/IMG_0336_15f50c3f-3300-46f6-aed0-a59d5b53c1ae.png?v=1742232271&width=800",
      "https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=900&q=80"
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
      "https://images.unsplash.com/photo-1518831959646-742c3a14ebf7?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1503919545889-aef636e10ad4?auto=format&fit=crop&w=900&q=80"
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

// Pedidos de muestra iniciales
export const INITIAL_SAMPLE_ORDERS = [
  {
    orderNumber: "YZ-8041",
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
        image: "https://cdn.shopify.com/s/files/1/0893/4391/8412/files/WhatsAppImage2026-10-20at18.44.17.jpg?v=1792619717"
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
    orderNumber: "YZ-8040",
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
        image: "https://cdn.shopify.com/s/files/1/0893/4391/8412/files/WhatsAppImage2026-10-30at09.40.20.jpg?v=1793354711"
      },
      {
        productId: "camiseta-basica-blanca",
        title: "CAMISETA BÁSICA BLANCA",
        size: "M",
        price: 14.25,
        quantity: 2,
        image: "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=900&q=80"
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
 * Convierte cualquier origen de imagen (dataUrl o URL externa) en un Blob WebP comprimido
 * Si la URL externa tiene bloqueo CORS, reintenta automáticamente a través de un proxy CORS (wsrv.nl)
 * @param {string} src
 * @param {number} maxHeight
 * @param {number} quality
 * @returns {Promise<Blob>}
 */
export async function imageSourceToWebpBlob(src, maxHeight = 1100, quality = 0.82) {
  if (!src) throw new Error("Origen de imagen vacío");

  if (typeof document === 'undefined' || typeof window === 'undefined') {
    return new Blob([], { type: 'image/webp' });
  }

  const loadImage = (imgUrl) => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Error cargando imagen desde ${imgUrl}`));
      img.src = imgUrl;
    });
  };

  let loadedImg = null;
  let objectUrlToRevoke = null;

  if (src.startsWith('data:')) {
    loadedImg = await loadImage(src);
  } else {
    // Si es una URL externa, intentar fetch directo para obtener Blob
    try {
      const response = await fetch(src, { mode: 'cors' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const rawBlob = await response.blob();
      objectUrlToRevoke = URL.createObjectURL(rawBlob);
      loadedImg = await loadImage(objectUrlToRevoke);
    } catch (corsErr) {
      console.warn(`[ImageConvert] Fetch directo falló para ${src}, intentando proxy CORS...`);
      const proxyUrl = `https://wsrv.nl/?url=${encodeURIComponent(src)}&output=webp&q=82`;
      try {
        const response = await fetch(proxyUrl, { mode: 'cors' });
        if (!response.ok) throw new Error(`Proxy HTTP ${response.status}`);
        const rawBlob = await response.blob();
        objectUrlToRevoke = URL.createObjectURL(rawBlob);
        loadedImg = await loadImage(objectUrlToRevoke);
      } catch (proxyErr) {
        console.warn(`[ImageConvert] Fetch proxy falló, cargando Image con proxy:`, proxyErr);
        loadedImg = await loadImage(proxyUrl);
      }
    }
  }

  // Redimensionar en canvas manteniendo proporción hasta maxHeight
  const canvas = document.createElement('canvas');
  let width = loadedImg.naturalWidth || loadedImg.width || 800;
  let height = loadedImg.naturalHeight || loadedImg.height || 1000;

  if (height > maxHeight) {
    width = Math.round((width * maxHeight) / height);
    height = maxHeight;
  }

  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  ctx.drawImage(loadedImg, 0, 0, width, height);

  if (objectUrlToRevoke) {
    URL.revokeObjectURL(objectUrlToRevoke);
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error("Error al convertir canvas a Blob WebP"));
      }
    }, 'image/webp', quality);
  });
}

/**
 * Sube una imagen (Base64 o URL externa) a Firebase Storage en formato WebP real
 * Retorna la URL pública oficial de firebasestorage.googleapis.com
 * @param {string} imageSource
 * @param {string} productId
 * @param {number} index
 * @returns {Promise<string>}
 */
export async function uploadProductImage(imageSource, productId, index = 0) {
  if (!imageSource) return "";

  // Si ya es una URL oficial de Firebase Storage, devolverla directamente
  if (typeof imageSource === 'string' && imageSource.startsWith("https://firebasestorage.googleapis.com/")) {
    return imageSource;
  }

  try {
    const webpBlob = await imageSourceToWebpBlob(imageSource);
    const filePath = `products/${productId}/foto_${index + 1}_${Date.now()}.webp`;
    const storageRef = ref(storage, filePath);

    await uploadBytes(storageRef, webpBlob, {
      contentType: 'image/webp',
      cacheControl: 'public,max-age=31536000'
    });

    const downloadUrl = await getDownloadURL(storageRef);
    return downloadUrl;
  } catch (err) {
    console.error("[FIREBASE STORAGE ERROR]:", err);
    throw err;
  }
}

/**
 * Migra todas las imágenes del catálogo que tengan URLs externas a Firebase Storage (.webp real)
 * y actualiza los documentos en Cloud Firestore
 * @param {Function} onProgressCallback ({ productTitle, current, total })
 * @returns {Promise<{ ok: boolean, migratedCount: number, totalImages: number, error?: string }>}
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
      const nonStorageCount = images.filter(img => typeof img === 'string' && !img.startsWith('https://firebasestorage.googleapis.com/')).length;
      totalImagesToMigrate += nonStorageCount;
    });

    if (totalImagesToMigrate === 0) {
      console.info("[Migrate] Todas las imágenes ya están alojadas en Firebase Storage.");
      return { ok: true, migratedCount: 0, totalImages: 0 };
    }

    console.info(`[Migrate] Iniciando migración de ${totalImagesToMigrate} imágenes a Firebase Storage...`);
    let currentProcessed = 0;

    for (const product of allProducts) {
      const images = product.images || [];
      const updatedImages = [];
      let productModified = false;

      for (let i = 0; i < images.length; i++) {
        const img = images[i];
        if (typeof img === 'string' && img.startsWith('https://firebasestorage.googleapis.com/')) {
          updatedImages.push(img);
        } else {
          currentProcessed++;
          if (typeof onProgressCallback === 'function') {
            onProgressCallback({
              productTitle: product.title,
              current: currentProcessed,
              total: totalImagesToMigrate
            });
          }

          try {
            const firebaseUrl = await uploadProductImage(img, product.id, i);
            updatedImages.push(firebaseUrl);
            productModified = true;
          } catch (uploadErr) {
            console.error(`[Migrate] Falló subida de imagen ${i} de "${product.title}":`, uploadErr);
            updatedImages.push(img); // Conservar original en caso de fallo aislado
          }
        }
      }

      if (productModified) {
        product.images = updatedImages;
        product.updatedAt = Date.now();
        await setDoc(doc(db, "products", product.id), sanitizeForFirestore(product), { merge: true });
        console.info(`[Migrate] Producto "${product.title}" actualizado en Firestore con fotos de Firebase Storage.`);
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
 * Sincroniza atómicamente todos los productos, ajustes y pedidos en Firebase Firestore mediante writeBatch
 * @param {Object} options { forceOverwrite = false }
 * @returns {Promise<{ ok: boolean, count?: number, errorCode?: string, errorMessage?: string }>}
 */
export async function syncAllToFirestore({ forceOverwrite = false } = {}) {
  try {
    const snap = await getDocs(collection(db, "products"));

    if (snap.empty || forceOverwrite) {
      console.info("[StoreService] Subiendo catálogo completo a Firestore mediante writeBatch...");
      
      // 1. Obtener datos locales o iniciales
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

      // 2. Crear lote de escritura atómico
      const batch = writeBatch(db);

      // Añadir productos
      for (const p of products) {
        const cleanP = sanitizeForFirestore(p);
        batch.set(doc(db, "products", String(cleanP.id)), cleanP);
      }

      // Añadir ajustes de tienda
      batch.set(doc(db, "settings", "store_config"), sanitizeForFirestore(settings));

      // Añadir pedidos
      for (const order of orders) {
        const cleanOrder = sanitizeForFirestore(order);
        batch.set(doc(db, "orders", String(cleanOrder.orderNumber)), cleanOrder);
      }

      // 3. Ejecutar lote de forma atómica en el servidor Firestore
      await batch.commit();

      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem(FIRESTORE_VERIFIED_KEY, 'true');
      }

      console.info("[StoreService] ¡writeBatch completado con éxito en Firestore!");
    }

    // 4. Verificar conteo real en el servidor Firestore
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
 * @param {Object} options { forceRefresh = false }
 * @returns {Promise<Array>}
 */
export async function getProducts({ forceRefresh = false } = {}) {
  const isVerifiedInSession = (typeof sessionStorage !== 'undefined') 
    && sessionStorage.getItem(FIRESTORE_VERIFIED_KEY) === 'true';

  // 1. Si no forzamos refresco y ya está verificado en Firestore en esta sesión, consultar caché de sesión
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

  // 2. Consultar Firebase Firestore directamente
  try {
    const productsColl = collection(db, "products");
    const snapshot = await getDocs(productsColl);

    // Caso A: Hay documentos en Firestore
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

    // Caso B: Colección vacía en Firestore -> Auto-seed forzado con writeBatch
    console.info("[StoreService] Colección vacía en Firestore. Ejecutando syncAllToFirestore...");
    const syncRes = await syncAllToFirestore({ forceOverwrite: true });
    if (syncRes.ok) {
      saveProductsToLocalAndCache(MOCK_PRODUCTS);
      return MOCK_PRODUCTS;
    }

  } catch (err) {
    console.warn("[StoreService] Error accediendo a Firestore, usando fallback local:", err?.message || err);
  }

  // Fallback transparente a localStorage para que la web nunca se quede en blanco
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

  // 1. Categoría
  if (category && category !== 'todos') {
    const catLow = category.toLowerCase().trim();
    products = products.filter(p => {
      const pCat = (p.category || '').toLowerCase();
      const pSub = (p.subCategory || '').toLowerCase();
      const pTags = (p.collectionTags || []).map(t => t.toLowerCase());
      return pCat === catLow || pSub === catLow || pTags.includes(catLow);
    });
  }

  // 2. Búsqueda por texto
  if (search && search.trim() !== '') {
    const q = search.toLowerCase().trim();
    products = products.filter(p => {
      return (p.title || '').toLowerCase().includes(q) ||
             (p.description || '').toLowerCase().includes(q) ||
             (p.subCategory || '').toLowerCase().includes(q);
    });
  }

  // 3. Solo en stock
  if (onlyInStock) {
    products = products.filter(p => {
      const stock = p.variants ? p.variants.reduce((acc, v) => acc + (v.stock || 0), 0) : 0;
      return stock > 0;
    });
  }

  // 4. Filtrar por talla
  if (size) {
    products = products.filter(p => {
      return p.variants && p.variants.some(v => v.size.toUpperCase() === size.toUpperCase() && v.stock > 0);
    });
  }

  // 5. Rango de precio
  if (minPrice !== null) {
    products = products.filter(p => p.price >= minPrice);
  }
  if (maxPrice !== null) {
    products = products.filter(p => p.price <= maxPrice);
  }

  // 6. Ordenación
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
 * Productos relacionados (excluyendo el actual)
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
export async function saveProduct(productData) {
  if (!productData || !productData.title) {
    throw new Error("El título de la prenda es obligatorio.");
  }

  // Normalización estricta de precios
  const price = parseFloat(String(productData.price || '0').replace(',', '.')) || 0;
  const compareAtPrice = productData.compareAtPrice 
    ? (parseFloat(String(productData.compareAtPrice).replace(',', '.')) || null)
    : null;
  const weightKg = parseFloat(String(productData.weightKg || '0.35').replace(',', '.')) || 0.35;

  // Generar ID/slug limpio si no existe
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

  // Subir imágenes base64 a Firebase Storage
  const finalImages = [];
  const rawImages = productData.images || [];
  for (let i = 0; i < rawImages.length; i++) {
    const imgUrl = await uploadProductImage(rawImages[i], id, i);
    finalImages.push(imgUrl);
  }

  const cleanProduct = sanitizeForFirestore({
    ...productData,
    id,
    slug: id,
    price,
    compareAtPrice,
    weightKg,
    images: finalImages.length > 0 ? finalImages : ['assets/img/placeholder.webp'],
    hasSizes: productData.hasSizes !== false,
    colors: Array.isArray(productData.colors) ? productData.colors : [],
    variants: Array.isArray(productData.variants) ? productData.variants : [{ size: 'ÚNICA', stock: 10 }],
    description: productData.description || "",
    active: productData.active !== false,
    createdAt: productData.createdAt || Date.now(),
    updatedAt: Date.now()
  });

  // 1. Guardar en Firestore directamente (lanza error si falla para diagnóstico)
  await setDoc(doc(db, "products", cleanProduct.id), cleanProduct);

  // 2. Guardar en localStorage
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

  // 3. Notificar a todas las pestañas abiertas
  invalidateCacheAndNotify('products_updated');
  return cleanProduct;
}

/**
 * Elimina una prenda de Firestore y del almacenamiento local
 */
export async function deleteProduct(productId) {
  if (!productId) return false;

  // Eliminar en Firestore
  await deleteDoc(doc(db, "products", productId));

  // Eliminar en localStorage
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
      
      // Actualizar en Firestore
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
export async function getOrders() {
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
 * Registra un nuevo pedido completado
 */
export async function createOrder(orderData) {
  const cleanOrder = sanitizeForFirestore(orderData);

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

  // Sincronizar atómicamente con Firestore
  await syncAllToFirestore({ forceOverwrite: true });

  invalidateCacheAndNotify('factory_reset');
  return true;
}
