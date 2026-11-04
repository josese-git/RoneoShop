/**
 * STORE SERVICE - CAPA DE DATOS CONTRATO FIRESTORE & SINCRONIZACIÓN EN VIVO (FASE 3.5)
 * Soporta modo local reactivo con BroadcastChannel y conexión real a Firebase Firestore.
 * Sin dependencias de emojis, con soporte para colores, tallas opcionales y esquema V2.
 */

import { isFirebaseActive, db } from './firebase-config.js';

// Claves de base de datos local compartida
export const DB_PRODUCTS_KEY = 'store_db_products_v2';
export const DB_SETTINGS_KEY = 'store_db_settings_v2';
export const ORDERS_STORAGE_KEY = 'store_orders_v1';

// Canal de difusión para sincronización en tiempo real entre pestañas
let syncChannel = null;
try {
  syncChannel = new BroadcastChannel('yoana_store_sync');
} catch (e) {
  // Fallback si BroadcastChannel no estuviera disponible
}

/**
 * Emite una notificación de actualización a todas las pestañas abiertas
 */
export function broadcastStoreChange(type = 'catalog_updated', data = null) {
  if (syncChannel) {
    try {
      syncChannel.postMessage({ type, data, timestamp: Date.now() });
    } catch (e) {}
  }
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(new CustomEvent('store:updated', { detail: { type, data } }));
  }
}

/**
 * Configuración global de la tienda por defecto
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
 */
export const MOCK_PRODUCTS = [
  // 1. ABRIGO PANDORA (Clon exacto PDF oficial - Agotado)
  {
    id: "abrigo-pandora",
    slug: "abrigo-pandora",
    title: "ABRIGO PANDORA",
    category: "ropa",
    subcategory: "chaquetas",
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
    subcategory: "vaqueros",
    collectionTags: ["otono-invierno", "novedades", "vaqueros"],
    price: 24.95,
    compareAtPrice: null,
    weightKg: 0.50,
    description: "Vaquero pitillo con efecto faja moldeadora y tiro extra alto que estiliza la figura proporcionando máxima comodidad.",
    hasSizes: true,
    colors: [
      { name: "Azul Denim", hex: "#3b5998", inStock: true }
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

  // 3. PANTALÓN HERMES (Del catálogo real)
  {
    id: "pantalon-hermes",
    slug: "pantalon-hermes",
    title: "PANTALÓN HERMES",
    category: "ropa",
    subcategory: "pantalones",
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

  // 4. VAQUERO MITOS (Del catálogo real)
  {
    id: "vaquero-mitos",
    slug: "vaquero-mitos",
    title: "VAQUERO MITOS",
    category: "ropa",
    subcategory: "vaqueros",
    collectionTags: ["otono-invierno", "vaqueros"],
    price: 24.95,
    compareAtPrice: null,
    weightKg: 0.52,
    description: "Denim de pierna recta clásica con lavado medio y refuerzo interior que estiliza la silueta.",
    hasSizes: true,
    colors: [
      { name: "Azul Medio", hex: "#4a6fa5", inStock: true }
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
    subcategory: "partes-de-arriba",
    collectionTags: ["primavera-verano", "novedades"],
    price: 14.25,
    compareAtPrice: null,
    weightKg: 0.18,
    description: "Camiseta de algodón peinado con escote redondo ribeteado y tacto ultrasuave. Fondo de armario imprescindible.",
    hasSizes: true,
    colors: [
      { name: "Blanco", hex: "#f9f9f9", inStock: true },
      { name: "Negro", hex: "#121212", inStock: true }
    ],
    images: [
      "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?auto=format&fit=crop&w=900&q=80"
    ],
    variants: [
      { size: "S", stock: 4, sku: "CA-BAS-S" },
      { size: "M", stock: 6, sku: "CA-BAS-M" },
      { size: "L", stock: 3, sku: "CA-BAS-L" }
    ],
    active: true,
    featured: true,
    createdAt: 1730715400000
  },

  // 6. CONJUNTO PUNTO MILÁN (En Rebaja)
  {
    id: "conjunto-punto-milan",
    slug: "conjunto-punto-milan",
    title: "CONJUNTO PUNTO MILÁN",
    category: "ropa",
    subcategory: "conjuntos",
    collectionTags: ["rebajas", "novedades", "otono-invierno"],
    price: 32.95,
    compareAtPrice: 39.95,
    weightKg: 0.60,
    description: "Conjunto de dos piezas tejido en punto canalé fino ultrasuave al tacto con top manga caída y pantalón recto fluido.",
    hasSizes: true,
    colors: [
      { name: "Camel", hex: "#c19a6b", inStock: true },
      { name: "Negro", hex: "#121212", inStock: true }
    ],
    images: [
      "https://cdn.shopify.com/s/files/1/0893/4391/8412/files/WhatsAppImage2026-10-30at09.40.20.jpg?v=1793354711",
      "https://images.unsplash.com/photo-1576995853123-5a10305d93c0?auto=format&fit=crop&w=900&q=80"
    ],
    variants: [
      { size: "S", stock: 2, sku: "CP-MIL-S" },
      { size: "M", stock: 4, sku: "CP-MIL-M" },
      { size: "L", stock: 1, sku: "CP-MIL-L" }
    ],
    active: true,
    featured: true,
    createdAt: 1730715500000
  },

  // 7. VESTIDO MIDI ZAFIRO
  {
    id: "vestido-midi-zafiro",
    slug: "vestido-midi-zafiro",
    title: "VESTIDO MIDI ZAFIRO",
    category: "ropa",
    subcategory: "vestidos",
    collectionTags: ["primavera-verano", "novedades", "vestidos"],
    price: 29.95,
    compareAtPrice: null,
    weightKg: 0.32,
    description: "Vestido midi lencero confeccionado en satén fluido con caída diagonal y espalda abierta.",
    hasSizes: true,
    colors: [
      { name: "Verde Esmeralda", hex: "#2e6f40", inStock: true },
      { name: "Negro", hex: "#121212", inStock: true }
    ],
    images: [
      "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1496747611176-843222e1e57c?auto=format&fit=crop&w=900&q=80"
    ],
    variants: [
      { size: "S", stock: 3, sku: "VM-ZAF-S" },
      { size: "M", stock: 2, sku: "VM-ZAF-M" },
      { size: "L", stock: 4, sku: "VM-ZAF-L" }
    ],
    active: true,
    featured: true,
    createdAt: 1730715600000
  },

  // 8. BODY ESCOTE ESPALDA (Rebaja)
  {
    id: "body-escote-espalda",
    slug: "body-escote-espalda",
    title: "BODY ESCOTE ESPALDA",
    category: "ropa",
    subcategory: "partes-de-arriba",
    collectionTags: ["rebajas", "primavera-verano"],
    price: 18.95,
    compareAtPrice: 24.95,
    weightKg: 0.18,
    description: "Body sin costuras confeccionado en punto técnico moldeador con escote profundo en espalda.",
    hasSizes: true,
    colors: [
      { name: "Negro", hex: "#121212", inStock: true }
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
    subcategory: "tratamiento-capilar",
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
    subcategory: "herramientas",
    collectionTags: ["cabello"],
    price: 54.95,
    compareAtPrice: null,
    weightKg: 0.78,
    description: "Secador con motor digital de 2200W y tecnología dual iónica para un acabado brillante sin encrespamiento.",
    hasSizes: false,
    colors: [
      { name: "Negro Mate", hex: "#1a1a1a", inStock: true }
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
    subcategory: "cosmetica",
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
    subcategory: "infantil",
    collectionTags: ["peikas", "novedades", "primavera-verano"],
    price: 22.95,
    compareAtPrice: null,
    weightKg: 0.28,
    description: "Conjunto infantil de blusa y cubrepañal con volantes calados confeccionado en algodón pima hipoalergénico.",
    hasSizes: true,
    colors: [
      { name: "Rosa Empolvado", hex: "#f4c2c2", inStock: true }
    ],
    images: [
      "https://images.unsplash.com/photo-1519457431-44ccd64a579b?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1503919545889-aef636e10ad4?auto=format&fit=crop&w=900&q=80"
    ],
    variants: [
      { size: "2-3A", stock: 2, sku: "PK-VOL-23" },
      { size: "4-5A", stock: 4, sku: "PK-VOL-45" },
      { size: "6-7A", stock: 3, sku: "PK-VOL-67" }
    ],
    active: true,
    featured: true,
    createdAt: 1730716100000
  }
];

/**
 * Pedidos de demostración iniciales
 */
export const INITIAL_SAMPLE_ORDERS = [
  {
    orderNumber: "261104194012",
    status: "PAID",
    paymentMethod: "BIZUM",
    subtotal: 19.95,
    shippingCost: 4.90,
    total: 24.85,
    totalWeightKg: 0.45,
    customer: {
      firstName: "Laura",
      lastName: "Gómez Pérez",
      email: "laura.gomez@email.com",
      phone: "611223344",
      street: "Calle Larios 14, 3º Izq",
      city: "Málaga",
      province: "Málaga",
      zipCode: "29005",
      country: "ES"
    },
    items: [
      {
        productId: "abrigo-pandora",
        title: "ABRIGO PANDORA",
        size: "S",
        price: 19.95,
        quantity: 1,
        image: "https://cdn.shopify.com/s/files/1/0893/4391/8412/files/WhatsAppImage2026-10-26at11.52.51.jpg?v=1793029856"
      }
    ],
    packlink: {
      synced: false,
      reference: "PENDIENTE-API",
      trackingUrl: ""
    },
    createdAt: 1762281612000,
    paidAt: 1762281655000
  },
  {
    orderNumber: "261104162005",
    status: "PAID",
    paymentMethod: "CARD",
    subtotal: 62.90,
    shippingCost: 0.00,
    total: 62.90,
    totalWeightKg: 0.92,
    customer: {
      firstName: "Carmen",
      lastName: "Ruiz Navarro",
      email: "carmen.ruiz@email.com",
      phone: "655889900",
      street: "Avenida Diagonal 450, 4º 1ª",
      city: "Barcelona",
      province: "Barcelona",
      zipCode: "08006",
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
        productId: "vestido-midi-zafiro",
        title: "VESTIDO MIDI ZAFIRO",
        size: "M",
        price: 29.95,
        quantity: 1,
        image: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=900&q=80"
      }
    ],
    packlink: {
      synced: true,
      reference: "ES2026PRO88412",
      trackingUrl: "https://pro.packlink.es/private/shipments"
    },
    createdAt: 1762269605000,
    paidAt: 1762269632000
  }
];

/**
 * Inicializa la base de datos local si no existe
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
 * Obtiene la configuración de la tienda
 */
export async function getStoreSettings() {
  let settings = MOCK_SETTINGS;

  if (isFirebaseActive() && db) {
    try {
      const { doc, getDoc } = await import("https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js");
      const docRef = doc(db, "settings", "store_config");
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        settings = docSnap.data();
      } else {
        // Sembrar settings iniciales en Firestore
        const { setDoc } = await import("https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js");
        await setDoc(docRef, MOCK_SETTINGS);
      }
    } catch (err) {
      console.warn("[StoreService] Fallo lectura Firestore settings, usando local:", err);
    }
  } else {
    try {
      const local = localStorage.getItem(DB_SETTINGS_KEY);
      if (local) settings = JSON.parse(local);
    } catch (e) {
      settings = MOCK_SETTINGS;
    }
  }

  return settings;
}

/**
 * Guarda la configuración de la tienda
 */
export async function saveStoreSettings(newSettings) {
  if (isFirebaseActive() && db) {
    try {
      const { doc, setDoc } = await import("https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js");
      await setDoc(doc(db, "settings", "store_config"), newSettings, { merge: true });
    } catch (err) {
      console.warn("[StoreService] Error guardando settings en Firestore:", err);
    }
  }

  try {
    localStorage.setItem(DB_SETTINGS_KEY, JSON.stringify(newSettings));
  } catch (e) {
    console.error("[StoreService] Error guardando settings en localStorage:", e);
  }

  broadcastStoreChange('settings_updated', newSettings);
  return newSettings;
}

/**
 * Obtiene todos los productos del catálogo
 */
export async function getProducts() {
  let products = [];

  if (isFirebaseActive() && db) {
    try {
      const { collection, getDocs, query, where, doc, setDoc } = await import("https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js");
      const q = query(collection(db, "products"), where("active", "==", true));
      const querySnapshot = await getDocs(q);

      const list = [];
      querySnapshot.forEach((d) => {
        list.push({ id: d.id, ...d.data() });
      });

      if (list.length > 0) {
        products = list;
        // Sincronizar en local
        localStorage.setItem(DB_PRODUCTS_KEY, JSON.stringify(products));
      } else {
        // La colección en Firestore está vacía: sembrar automáticamente los 12 productos
        console.info("[StoreService] Sembrando catálogo inicial en Firestore...");
        for (const p of MOCK_PRODUCTS) {
          await setDoc(doc(db, "products", p.id), p);
        }
        products = MOCK_PRODUCTS;
        localStorage.setItem(DB_PRODUCTS_KEY, JSON.stringify(products));
      }
    } catch (err) {
      console.warn("[StoreService] Error Firestore getProducts, recurriendo a local:", err);
      products = readLocalProducts();
    }
  } else {
    products = readLocalProducts();
  }

  return products;
}

function readLocalProducts() {
  try {
    const raw = localStorage.getItem(DB_PRODUCTS_KEY);
    return raw ? JSON.parse(raw) : MOCK_PRODUCTS;
  } catch (e) {
    return MOCK_PRODUCTS;
  }
}

/**
 * Guarda o actualiza un producto (sincronizado en local y Firestore)
 */
export async function saveProduct(productData) {
  const currentCatalog = await getProducts();
  const index = currentCatalog.findIndex(p => p.id === productData.id);

  let updatedProduct;

  if (index > -1) {
    updatedProduct = {
      ...currentCatalog[index],
      ...productData,
      updatedAt: Date.now()
    };
    currentCatalog[index] = updatedProduct;
  } else {
    const cleanSlug = (productData.slug || productData.title || 'prenda')
      .toLowerCase()
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');

    const newId = productData.id || `${cleanSlug}-${Date.now().toString().slice(-4)}`;

    updatedProduct = {
      ...productData,
      id: newId,
      slug: cleanSlug,
      hasSizes: productData.hasSizes !== undefined ? productData.hasSizes : true,
      colors: productData.colors || [],
      active: productData.active !== undefined ? productData.active : true,
      featured: productData.featured !== undefined ? productData.featured : false,
      createdAt: Date.now()
    };

    currentCatalog.unshift(updatedProduct);
  }

  // Guardar en Firestore si está conectado
  if (isFirebaseActive() && db) {
    try {
      const { doc, setDoc } = await import("https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js");
      await setDoc(doc(db, "products", updatedProduct.id), updatedProduct, { merge: true });
    } catch (err) {
      console.warn("[StoreService] Error guardando en Firestore:", err);
    }
  }

  // Guardar en localStorage
  try {
    localStorage.setItem(DB_PRODUCTS_KEY, JSON.stringify(currentCatalog));
  } catch (e) {
    console.error("[StoreService] Error guardando producto en localStorage:", e);
  }

  broadcastStoreChange('product_saved', updatedProduct);
  return updatedProduct;
}

/**
 * Elimina una prenda del catálogo
 */
export async function deleteProduct(productId) {
  const currentCatalog = await getProducts();
  const filtered = currentCatalog.filter(p => p.id !== productId);

  if (isFirebaseActive() && db) {
    try {
      const { doc, deleteDoc } = await import("https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js");
      await deleteDoc(doc(db, "products", productId));
    } catch (err) {
      console.warn("[StoreService] Error borrando en Firestore:", err);
    }
  }

  try {
    localStorage.setItem(DB_PRODUCTS_KEY, JSON.stringify(filtered));
  } catch (e) {
    console.error("[StoreService] Error borrando en localStorage:", e);
  }

  broadcastStoreChange('product_deleted', productId);
  return true;
}

/**
 * Descuenta stock tras pedido y sincroniza inmediatamente
 */
export async function updateProductStockAfterOrder(orderItems) {
  if (!orderItems || orderItems.length === 0) return;

  const currentCatalog = await getProducts();
  let modified = false;

  for (const item of orderItems) {
    const prod = currentCatalog.find(p => p.id === item.productId);
    if (!prod || !prod.variants) continue;

    const variant = prod.variants.find(v => v.size === item.size);
    if (variant) {
      variant.stock = Math.max(0, variant.stock - (item.quantity || 1));
      modified = true;
    }
  }

  if (modified) {
    try {
      localStorage.setItem(DB_PRODUCTS_KEY, JSON.stringify(currentCatalog));
    } catch (e) {}

    if (isFirebaseActive() && db) {
      try {
        const { doc, updateDoc } = await import("https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js");
        for (const item of orderItems) {
          const prod = currentCatalog.find(p => p.id === item.productId);
          if (prod) {
            await updateDoc(doc(db, "products", prod.id), { variants: prod.variants });
          }
        }
      } catch (err) {
        console.warn("[StoreService] Error actualizando stock en Firestore:", err);
      }
    }

    broadcastStoreChange('stock_updated', orderItems);
  }
}

/**
 * Obtiene la lista de pedidos
 */
export function getOrders() {
  try {
    const raw = localStorage.getItem(ORDERS_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(INITIAL_SAMPLE_ORDERS));
      return INITIAL_SAMPLE_ORDERS;
    }
    const orders = JSON.parse(raw);
    return orders.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  } catch (e) {
    return [];
  }
}

/**
 * Guarda o actualiza un pedido
 */
export function updateOrderStatus(orderNumber, updates) {
  try {
    const orders = getOrders();
    const index = orders.findIndex(o => o.orderNumber === orderNumber);
    if (index === -1) return null;

    orders[index] = {
      ...orders[index],
      ...updates,
      packlink: {
        ...orders[index].packlink,
        ...(updates.packlink || {})
      }
    };

    localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(orders));

    if (isFirebaseActive() && db) {
      import("https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js").then(({ doc, updateDoc }) => {
        updateDoc(doc(db, "orders", orderNumber), orders[index]).catch(() => {});
      });
    }

    broadcastStoreChange('order_updated', orders[index]);
    return orders[index];
  } catch (e) {
    return null;
  }
}

/**
 * Restaura base de datos completa de fábrica
 */
export function resetDatabaseToFactory() {
  try {
    localStorage.setItem(DB_PRODUCTS_KEY, JSON.stringify(MOCK_PRODUCTS));
    localStorage.setItem(DB_SETTINGS_KEY, JSON.stringify(MOCK_SETTINGS));
    localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(INITIAL_SAMPLE_ORDERS));
    broadcastStoreChange('database_reset');
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Sincroniza todo el catálogo local con Firebase Firestore en 1 clic
 */
export async function syncLocalCatalogToFirestore() {
  if (!isFirebaseActive() || !db) return false;

  try {
    const { doc, setDoc } = await import("https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js");
    const products = readLocalProducts();

    for (const p of products) {
      await setDoc(doc(db, "products", p.id), p, { merge: true });
    }

    const settings = await getStoreSettings();
    await setDoc(doc(db, "settings", "store_config"), settings, { merge: true });

    broadcastStoreChange('firestore_synced');
    return true;
  } catch (err) {
    console.error("[StoreService] Error al sincronizar con Firestore:", err);
    return false;
  }
}

/**
 * Busca un producto por ID o slug
 */
export async function getProductByIdOrSlug(idOrSlug) {
  if (!idOrSlug) return null;
  const products = await getProducts();
  const normalized = String(idOrSlug).toLowerCase().trim();
  return products.find(p => 
    p.id.toLowerCase() === normalized || 
    (p.slug && p.slug.toLowerCase() === normalized)
  ) || null;
}

/**
 * Filtra y ordena productos dinámicamente
 */
export async function getProductsByFilter({ 
  category = null, 
  collection = null, 
  search = '', 
  onlyInStock = false, 
  size = null,
  minPrice = null,
  maxPrice = null,
  sortBy = 'featured' 
} = {}) {
  const products = await getProducts();
  let list = [...products];

  if (category && category !== 'todos' && category !== 'all') {
    const c = category.toLowerCase();
    if (c === 'rebajas') {
      list = list.filter(p => p.compareAtPrice && p.compareAtPrice > p.price);
    } else if (['otono-invierno', 'primavera-verano', 'tratamiento-capilar', 'novedades'].includes(c)) {
      list = list.filter(p => 
        (p.collectionTags && p.collectionTags.includes(c)) || 
        p.subcategory === c
      );
    } else {
      list = list.filter(p => 
        p.category.toLowerCase() === c || 
        (p.subcategory && p.subcategory.toLowerCase() === c) ||
        (p.collectionTags && p.collectionTags.includes(c))
      );
    }
  }

  if (collection && collection !== 'todos') {
    const col = collection.toLowerCase();
    list = list.filter(p => 
      (p.collectionTags && p.collectionTags.includes(col)) ||
      p.subcategory === col
    );
  }

  if (search && search.trim() !== '') {
    const q = search.toLowerCase().trim();
    list = list.filter(p => 
      p.title.toLowerCase().includes(q) ||
      (p.description && p.description.toLowerCase().includes(q)) ||
      p.category.toLowerCase().includes(q) ||
      (p.subcategory && p.subcategory.toLowerCase().includes(q))
    );
  }

  if (onlyInStock) {
    list = list.filter(p => {
      const totalStock = p.variants ? p.variants.reduce((acc, v) => acc + v.stock, 0) : 0;
      return totalStock > 0;
    });
  }

  if (size && size.trim() !== '') {
    const targetSize = size.toUpperCase().trim();
    list = list.filter(p => 
      p.variants && p.variants.some(v => v.size.toUpperCase() === targetSize && v.stock > 0)
    );
  }

  if (minPrice !== null && !isNaN(minPrice)) {
    list = list.filter(p => p.price >= Number(minPrice));
  }
  if (maxPrice !== null && !isNaN(maxPrice)) {
    list = list.filter(p => p.price <= Number(maxPrice));
  }

  if (sortBy === 'price-asc') {
    list.sort((a, b) => a.price - b.price);
  } else if (sortBy === 'price-desc') {
    list.sort((a, b) => b.price - a.price);
  } else if (sortBy === 'newest') {
    list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  } else {
    list.sort((a, b) => {
      const stockA = a.variants ? a.variants.reduce((acc, v) => acc + v.stock, 0) : 0;
      const stockB = b.variants ? b.variants.reduce((acc, v) => acc + v.stock, 0) : 0;
      if (stockA > 0 && stockB === 0) return -1;
      if (stockA === 0 && stockB > 0) return 1;
      return (b.featured ? 1 : 0) - (a.featured ? 1 : 0);
    });
  }

  return list;
}

/**
 * Obtiene productos relacionados
 */
export async function getRelatedProducts(currentProductId, category, limit = 4) {
  const products = await getProducts();
  const filtered = products.filter(p => p.id !== currentProductId);

  let sameCategory = filtered.filter(p => p.category.toLowerCase() === (category || '').toLowerCase());
  
  if (sameCategory.length < limit) {
    const others = filtered.filter(p => p.category.toLowerCase() !== (category || '').toLowerCase());
    sameCategory = [...sameCategory, ...others];
  }

  return sameCategory.slice(0, limit);
}
