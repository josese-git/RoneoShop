/**
 * STORE SERVICE - RONEO SHOP (FASE 5.1 DEFINITIVA)
 * Motor central de datos conectado a Firebase Firestore + Firebase Storage.
 * Patron Singleton Observer con onSnapshot (< 100ms) reactivo.
 * Gestión clasificada de stock por Color y Talla (ARCHITECTURE.md).
 * Categorías oficiales: Ropa, Calzado, Más próximamente...
 * Zero Emojis · 100% Iconos Vectoriales.
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
  onSnapshot,
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
  listAll,
  sanitizeForFirestore,
  buildCleanStorageUrl as configBuildCleanStorageUrl
} from './firebase-config.js';

import {
  DEFAULT_PACKLINK_API_KEY,
  DEFAULT_PARCEL_DIMENSIONS,
  FIXED_SENDER_ADDRESS,
  createPacklinkShipment,
  getPacklinkRates,
  getCorreosShippingOptions,
  resolvePacklinkPostalZone,
  resolvePacklinkPostalLocation,
  roundShippingPriceTo99,
  getPacklinkShipmentStatus,
  getPacklinkShipmentLabels,
  buildPacklinkShipmentPayload,
  buildCleanSingleStreet,
  getNextBusinessDayFormatted
} from './packlink-service.js';

export {
  DEFAULT_PACKLINK_API_KEY,
  DEFAULT_PARCEL_DIMENSIONS,
  FIXED_SENDER_ADDRESS,
  createPacklinkShipment,
  getPacklinkRates,
  getCorreosShippingOptions,
  resolvePacklinkPostalZone,
  resolvePacklinkPostalLocation,
  roundShippingPriceTo99,
  getPacklinkShipmentStatus,
  getPacklinkShipmentLabels,
  buildPacklinkShipmentPayload,
  buildCleanSingleStreet,
  getNextBusinessDayFormatted
};

// Claves de persistencia y cache local de respaldo
const STORAGE_PRODUCTS_KEY = 'store_db_products_v9';
const STORAGE_SETTINGS_KEY = 'store_db_settings_v9';
const STORAGE_ORDERS_KEY = 'store_orders_v9';

// Categorías base oficiales de la marca Roneo Shop
export const DEFAULT_CATEGORIES = [
  { id: "ropa", name: "Ropa", slug: "ropa", order: 0, isPlaceholder: false },
  { id: "calzado", name: "Calzado", slug: "calzado", order: 1, isPlaceholder: false },
  { id: "mas-proximamente", name: "Más próximamente...", slug: "mas-proximamente", order: 2, isPlaceholder: true }
];

export const DEFAULT_COLLECTIONS = [
  {
    id: "otono-invierno",
    title: "OTOÑO & INVIERNO",
    subtitle: "Colección de temporada",
    slug: "otono-invierno",
    image: "https://images.unsplash.com/photo-1539533018447-63fcce2678e3?auto=format&fit=crop&w=800&q=82",
    order: 0,
    active: true
  },
  {
    id: "primavera-verano",
    title: "PRIMAVERA & VERANO",
    subtitle: "Prendas fluidas y luminosas",
    slug: "primavera-verano",
    image: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=800&q=82",
    order: 1,
    active: true
  },
  {
    id: "calzado",
    title: "CALZADO",
    subtitle: "Colección piel",
    slug: "calzado",
    image: "https://images.unsplash.com/photo-1543163521-1bf539c55dd2?auto=format&fit=crop&w=800&q=82",
    order: 2,
    active: true
  },
  {
    id: "rebajas",
    title: "NOVEDADES & REBAJAS",
    subtitle: "Descuentos de temporada",
    slug: "rebajas",
    image: "https://images.unsplash.com/photo-1441984904996-e0b6ba687e04?auto=format&fit=crop&w=800&q=82",
    order: 3,
    active: true
  }
];

export const MOCK_SETTINGS = {
  storeName: "Roneo Shop",
  announcementText: "NUEVA COLECCIÓN 2026 OTOÑO & INVIERNO · ENVÍO GRATIS A PARTIR DE 50€",
  heroTitle: "Roneo Shop",
  heroSubtitle: "Prendas de diseño contemporáneo, calzado en piel vacuna y accesorios seleccionados con máxima atención al detalle.",
  heroImage: "",
  shippingStandardPrice: 4.99,
  standardShippingPrice: 4.99,
  freeShippingThreshold: 50.00,
  contactPhone: "+34 622 06 36 91",
  contactEmail: "1roneoshop@gmail.com",
  instagramUrl: "https://instagram.com/",
  storeSchedule: "Lunes a Viernes de 10:00 a 20:00",
  returnPolicySummary: "Dispones de 14 días naturales desde la recepción del pedido para cambios de talla o devoluciones.",
  categories: DEFAULT_CATEGORIES,
  collections: DEFAULT_COLLECTIONS,
  senderAddress: FIXED_SENDER_ADDRESS,
  senderName: FIXED_SENDER_ADDRESS.fullName,
  senderCompany: FIXED_SENDER_ADDRESS.company,
  senderStreet: FIXED_SENDER_ADDRESS.street,
  senderZip: FIXED_SENDER_ADDRESS.zip_code,
  senderCity: FIXED_SENDER_ADDRESS.city,
  senderProvince: FIXED_SENDER_ADDRESS.province,
  senderCountry: FIXED_SENDER_ADDRESS.country,
  senderPhone: FIXED_SENDER_ADDRESS.phone,
  senderEmail: FIXED_SENDER_ADDRESS.email,
  packlinkApiKey: DEFAULT_PACKLINK_API_KEY,
  packlinkAutoSync: true,
  packlinkParcel: {
    length: 30,
    width: 25,
    height: 10,
    defaultWeight: 0.5
  },
  updatedAt: Date.now()
};

export function normalizeSettingsSchema(raw = {}) {
  const base = { ...MOCK_SETTINGS, ...(raw || {}) };

  // Erradicación y sanitización obligatoria de fotos antiguas de Unsplash
  if (base.heroImage && (base.heroImage.includes('unsplash.com') || base.heroImage.includes('photo-1534528741775'))) {
    base.heroImage = "";
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem('roneo_hero_image_v1');
      }
    } catch (e) {}
  }

  // Erradicación y sanitización obligatoria de marcas obsoletas
  if (!base.storeName || /yoana|zafiro/i.test(base.storeName)) {
    base.storeName = "Roneo Shop";
  }
  if (!base.heroTitle || /yoana|zafiro/i.test(base.heroTitle)) {
    base.heroTitle = "Roneo Shop";
  }
  if (!base.contactEmail || /yoanazafiro\.com|info@roneoshop\.com/i.test(base.contactEmail)) {
    base.contactEmail = FIXED_SENDER_ADDRESS.email;
  }
  if (!base.contactPhone || /600000000/i.test(base.contactPhone)) {
    base.contactPhone = FIXED_SENDER_ADDRESS.phoneFormatted;
  }

  // Regla matemática de redondeo de envíos a ,99€
  const rawShip = parseFloat(String(base.shippingStandardPrice ?? base.standardShippingPrice ?? 4.99).replace(',', '.'));
  base.shippingStandardPrice = isNaN(rawShip) ? 4.99 : roundShippingPriceTo99(rawShip);
  base.standardShippingPrice = base.shippingStandardPrice;

  const thresh = parseFloat(String(base.freeShippingThreshold ?? 50.00).replace(',', '.'));
  base.freeShippingThreshold = isNaN(thresh) ? 50.00 : thresh;

  const rawCats = Array.isArray(base.categories) && base.categories.length > 0 ? base.categories : DEFAULT_CATEGORIES;
  base.categories = rawCats.filter(c => !['cabello', 'cosmetica', 'peikas'].includes(c.id || c.slug));
  if (base.categories.length === 0) base.categories = DEFAULT_CATEGORIES;

  const rawCols = Array.isArray(base.collections) && base.collections.length > 0 ? base.collections : DEFAULT_COLLECTIONS;
  base.collections = rawCols.filter(c => !['cabello', 'cosmetica', 'peikas'].includes(c.id || c.slug));
  if (base.collections.length === 0) base.collections = DEFAULT_COLLECTIONS;

  // Detección de datos antiguos de relleno del remitente
  const currentSender = raw?.senderAddress || {};
  const isObsoleteSender = 
    !currentSender.street ||
    /calle principal|29001|m[aá]laga|600000000|info@roneoshop/i.test(currentSender.street || '') ||
    /29001/i.test(currentSender.zipCode || currentSender.zip || '') ||
    /m[aá]laga/i.test(currentSender.city || '') ||
    /600000000/i.test(currentSender.phone || '');

  // Datos fijos e inmutables del remitente (Nerea Cortes Muñoz en Torredonjimeno 23650)
  base.senderAddress = { ...FIXED_SENDER_ADDRESS };
  base.senderName = FIXED_SENDER_ADDRESS.fullName;
  base.senderCompany = FIXED_SENDER_ADDRESS.company;
  base.senderStreet = FIXED_SENDER_ADDRESS.street;
  base.senderZip = FIXED_SENDER_ADDRESS.zip_code;
  base.senderCity = FIXED_SENDER_ADDRESS.city;
  base.senderProvince = FIXED_SENDER_ADDRESS.province;
  base.senderPhone = FIXED_SENDER_ADDRESS.phone;
  base.senderEmail = FIXED_SENDER_ADDRESS.email;

  // Si en Firestore todavía estaban guardados datos de prueba obsoletos, los corregimos automáticamente
  if (isObsoleteSender && typeof db !== 'undefined' && db) {
    try {
      const configRef = doc(db, 'settings', 'store_config');
      setDoc(configRef, {
        senderAddress: FIXED_SENDER_ADDRESS,
        senderName: FIXED_SENDER_ADDRESS.fullName,
        senderCompany: FIXED_SENDER_ADDRESS.company,
        senderStreet: FIXED_SENDER_ADDRESS.street,
        senderZip: FIXED_SENDER_ADDRESS.zip_code,
        senderCity: FIXED_SENDER_ADDRESS.city,
        senderProvince: FIXED_SENDER_ADDRESS.province,
        senderPhone: FIXED_SENDER_ADDRESS.phone,
        senderEmail: FIXED_SENDER_ADDRESS.email,
        contactEmail: FIXED_SENDER_ADDRESS.email,
        contactPhone: FIXED_SENDER_ADDRESS.phoneFormatted,
        shippingStandardPrice: base.shippingStandardPrice,
        standardShippingPrice: base.shippingStandardPrice
      }, { merge: true }).catch(err => {
        console.warn("[store-service] Error actualizando remitente fijo en Firestore:", err?.message || err);
      });
    } catch (e) {}
  }

  // Normalización oficial Packlink PRO API
  const plKey = String(raw?.packlinkApiKey || raw?.packlink?.apiKey || base.packlinkApiKey || '').trim();
  base.packlinkApiKey = (plKey.length > 20) ? plKey : DEFAULT_PACKLINK_API_KEY;
  base.packlinkAutoSync = raw?.packlinkAutoSync !== undefined ? Boolean(raw.packlinkAutoSync) : true;
  base.packlinkParcel = {
    length: parseInt(raw?.packlinkParcel?.length || 30, 10),
    width: parseInt(raw?.packlinkParcel?.width || 25, 10),
    height: parseInt(raw?.packlinkParcel?.height || 10, 10),
    defaultWeight: parseFloat(raw?.packlinkParcel?.defaultWeight || 0.5)
  };

  return base;
}

/**
 * Generador de URL limpia de Firebase Storage
 */
export function buildCleanStorageUrl(filePath, version = '') {
  if (typeof configBuildCleanStorageUrl === 'function') {
    return configBuildCleanStorageUrl(filePath, version);
  }
  const bucket = firebaseConfig.storageBucket || "roneoshop-es.firebasestorage.app";
  const cleanPath = String(filePath || '').replace(/^\/+/, '');
  const encodedPath = cleanPath.split('/').map(segment => encodeURIComponent(segment)).join('%2F');
  const vParam = version ? `&v=${version}` : '';
  return `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodedPath}?alt=media${vParam}`;
}

/**
 * Catálogo inicial de prendas y calzado oficial (Sin cabello, cosmética ni peikas)
 */
export const DEFAULT_CATALOG = [
  {
    id: "abrigo-pandora",
    title: "Abrigo Pandora Camel",
    slug: "abrigo-pandora-camel",
    description: "Abrigo estructurado confeccionado en paño suave con solapa ancha cruzada y cinturón a tono. Forro interior satinado.",
    category: "ropa",
    collection: "otono-invierno",
    price: 49.95,
    compareAtPrice: 69.95,
    weightKg: 0.95,
    active: true,
    featured: true,
    order: 0,
    hasSizes: true,
    images: [
      "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=1080&q=82",
      "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=1080&q=82"
    ],
    colors: [
      {
        name: "Camel",
        hex: "#c19a6b",
        imageIndex: 0,
        sizes: [
          { size: "S", stock: 3 },
          { size: "M", stock: 4 },
          { size: "L", stock: 2 }
        ]
      },
      {
        name: "Negro",
        hex: "#121212",
        imageIndex: 1,
        sizes: [
          { size: "S", stock: 2 },
          { size: "M", stock: 5 },
          { size: "L", stock: 1 }
        ]
      }
    ]
  },
  {
    id: "vestido-roneo",
    title: "Vestido Midi Roneo Negro",
    slug: "vestido-midi-roneo-negro",
    description: "Vestido midi de punto fino acanalado con escote asimétrico y abertura lateral elegante.",
    category: "ropa",
    collection: "otono-invierno",
    price: 29.95,
    compareAtPrice: 39.95,
    weightKg: 0.38,
    active: true,
    featured: true,
    order: 1,
    hasSizes: true,
    images: [
      "https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?auto=format&fit=crop&w=1080&q=82",
      "https://images.unsplash.com/photo-1595777457583-95e059d581b8?auto=format&fit=crop&w=1080&q=82"
    ],
    colors: [
      {
        name: "Negro",
        hex: "#121212",
        imageIndex: 0,
        sizes: [
          { size: "XS", stock: 2 },
          { size: "S", stock: 4 },
          { size: "M", stock: 5 },
          { size: "L", stock: 2 }
        ]
      },
      {
        name: "Beige",
        hex: "#e8dfc8",
        imageIndex: 1,
        sizes: [
          { size: "XS", stock: 1 },
          { size: "S", stock: 3 },
          { size: "M", stock: 3 },
          { size: "L", stock: 0 }
        ]
      }
    ]
  },
  {
    id: "vaquero-faja-pushup",
    title: "Jeans Faja Esculpidor Skinny",
    slug: "jeans-faja-esculpidor-skinny",
    description: "Vaquero de tiro alto con refuerzo interior faja reductora y costuras traseras efecto push-up.",
    category: "ropa",
    collection: "novedades",
    price: 34.95,
    compareAtPrice: 44.95,
    weightKg: 0.52,
    active: true,
    featured: true,
    order: 2,
    hasSizes: true,
    images: [
      "https://images.unsplash.com/photo-1541099649105-f69ad21f3246?auto=format&fit=crop&w=1080&q=82",
      "https://images.unsplash.com/photo-1582418702059-97ebafb35d09?auto=format&fit=crop&w=1080&q=82"
    ],
    colors: [
      {
        name: "Azul Denim",
        hex: "#3b5998",
        imageIndex: 0,
        sizes: [
          { size: "36", stock: 4 },
          { size: "38", stock: 6 },
          { size: "40", stock: 5 },
          { size: "42", stock: 3 }
        ]
      },
      {
        name: "Gris",
        hex: "#808080",
        imageIndex: 1,
        sizes: [
          { size: "36", stock: 2 },
          { size: "38", stock: 4 },
          { size: "40", stock: 3 },
          { size: "42", stock: 1 }
        ]
      }
    ]
  },
  {
    id: "conjunto-punto-monaco",
    title: "Conjunto Dos Piezas Punto Mónaco",
    slug: "conjunto-dos-piezas-punto-monaco",
    description: "Dos piezas formado por jersey de cuello perkins holgado y falda tubo midi en punto canalé premium.",
    category: "ropa",
    collection: "otono-invierno",
    price: 39.95,
    compareAtPrice: 54.95,
    weightKg: 0.65,
    active: true,
    featured: true,
    order: 3,
    hasSizes: true,
    images: [
      "https://images.unsplash.com/photo-1584273143981-41c073dfe8f8?auto=format&fit=crop&w=1080&q=82",
      "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=1080&q=82"
    ],
    colors: [
      {
        name: "Beige",
        hex: "#e8dfc8",
        imageIndex: 0,
        sizes: [
          { size: "S", stock: 3 },
          { size: "M", stock: 5 },
          { size: "L", stock: 2 }
        ]
      },
      {
        name: "Gris",
        hex: "#808080",
        imageIndex: 1,
        sizes: [
          { size: "S", stock: 2 },
          { size: "M", stock: 3 },
          { size: "L", stock: 1 }
        ]
      }
    ]
  },
  {
    id: "blazer-sastre-milan",
    title: "Blazer Cruzada Milán",
    slug: "blazer-cruzada-milan",
    description: "Americana cruzada oversize con hombreras estructuradas y botones dorados efecto joya.",
    category: "ropa",
    collection: "novedades",
    price: 44.95,
    compareAtPrice: 59.95,
    weightKg: 0.70,
    active: true,
    featured: true,
    order: 4,
    hasSizes: true,
    images: [
      "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?auto=format&fit=crop&w=1080&q=82",
      "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=1080&q=82"
    ],
    colors: [
      {
        name: "Negro",
        hex: "#121212",
        imageIndex: 0,
        sizes: [
          { size: "XS", stock: 2 },
          { size: "S", stock: 4 },
          { size: "M", stock: 4 },
          { size: "L", stock: 2 }
        ]
      },
      {
        name: "Blanco",
        hex: "#ffffff",
        imageIndex: 1,
        sizes: [
          { size: "XS", stock: 1 },
          { size: "S", stock: 3 },
          { size: "M", stock: 2 },
          { size: "L", stock: 1 }
        ]
      }
    ]
  },
  {
    id: "pantalon-palazzo-seda",
    title: "Pantalón Palazzo Fluido Crepe",
    slug: "pantalon-palazzo-fluido-crepe",
    description: "Pantalón de pernera ancha y tiro muy alto con pinzas delanteras y caída impecable.",
    category: "ropa",
    collection: "primavera-verano",
    price: 27.95,
    compareAtPrice: 34.95,
    weightKg: 0.32,
    active: true,
    featured: false,
    order: 5,
    hasSizes: true,
    images: [
      "https://images.unsplash.com/photo-1509631179647-0177331693ae?auto=format&fit=crop&w=1080&q=82"
    ],
    colors: [
      {
        name: "Beige",
        hex: "#e8dfc8",
        imageIndex: 0,
        sizes: [
          { size: "S", stock: 4 },
          { size: "M", stock: 5 },
          { size: "L", stock: 3 }
        ]
      },
      {
        name: "Negro",
        hex: "#121212",
        imageIndex: 0,
        sizes: [
          { size: "S", stock: 3 },
          { size: "M", stock: 4 },
          { size: "L", stock: 2 }
        ]
      }
    ]
  },
  {
    id: "body-moldeador-invisible",
    title: "Body Moldeador Espalda Descubierta",
    slug: "body-moldeador-espalda-descubierta",
    description: "Body reductor sin costuras laterales con copas push-up invisibles y tirantes multiposición transparentes.",
    category: "ropa",
    collection: "primavera-verano",
    price: 26.50,
    compareAtPrice: 35.00,
    weightKg: 0.22,
    active: true,
    featured: false,
    order: 6,
    hasSizes: true,
    images: [
      "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=1080&q=82"
    ],
    colors: [
      {
        name: "Nude",
        hex: "#e8dfc8",
        imageIndex: 0,
        sizes: [
          { size: "S", stock: 5 },
          { size: "M", stock: 6 },
          { size: "L", stock: 3 }
        ]
      },
      {
        name: "Negro",
        hex: "#121212",
        imageIndex: 0,
        sizes: [
          { size: "S", stock: 4 },
          { size: "M", stock: 5 },
          { size: "L", stock: 2 }
        ]
      }
    ]
  },
  // --- NUEVA LÍNEA DE CALZADO ---
  {
    id: "botin-chelsea-piel-negro",
    title: "Botín Chelsea Piel",
    slug: "botin-chelsea-piel-negro",
    description: "Botín chelsea confeccionado en piel vacuna con elásticos laterales y suela track dentada ligera de gran amortiguación.",
    category: "calzado",
    collection: "otono-invierno",
    price: 39.95,
    compareAtPrice: 49.95,
    weightKg: 0.85,
    active: true,
    featured: true,
    order: 7,
    hasSizes: true,
    images: [
      "https://images.unsplash.com/photo-1543163521-1bf539c55dd2?auto=format&fit=crop&w=1080&q=82",
      "https://images.unsplash.com/photo-1608256246200-53e635b5b65f?auto=format&fit=crop&w=1080&q=82"
    ],
    colors: [
      {
        name: "Negro",
        hex: "#121212",
        imageIndex: 0,
        sizes: [
          { size: "36", stock: 3 },
          { size: "37", stock: 4 },
          { size: "38", stock: 5 },
          { size: "39", stock: 4 },
          { size: "40", stock: 2 }
        ]
      },
      {
        name: "Marrón",
        hex: "#5c4033",
        imageIndex: 1,
        sizes: [
          { size: "36", stock: 2 },
          { size: "37", stock: 3 },
          { size: "38", stock: 4 },
          { size: "39", stock: 3 },
          { size: "40", stock: 1 }
        ]
      }
    ]
  },
  {
    id: "bota-alta-tacon-beige",
    title: "Bota Alta Tacón Geométrico",
    slug: "bota-alta-tacon-beige",
    description: "Bota de caña alta en ante suave con tacón geométrico de 7 cm y cremallera interior invisible. Ajuste favorecedor a la pierna.",
    category: "calzado",
    collection: "otono-invierno",
    price: 44.95,
    compareAtPrice: 59.95,
    weightKg: 0.90,
    active: true,
    featured: true,
    order: 8,
    hasSizes: true,
    images: [
      "https://images.unsplash.com/photo-1535043934128-cf0b28d52f95?auto=format&fit=crop&w=1080&q=82"
    ],
    colors: [
      {
        name: "Beige",
        hex: "#e8dfc8",
        imageIndex: 0,
        sizes: [
          { size: "36", stock: 2 },
          { size: "37", stock: 4 },
          { size: "38", stock: 4 },
          { size: "39", stock: 3 },
          { size: "40", stock: 2 }
        ]
      }
    ]
  },
  {
    id: "deportiva-minimal-blanca",
    title: "Sneaker Minimal Plataforma",
    slug: "deportiva-minimal-blanca",
    description: "Zapatilla deportiva de estética limpia con plataforma ligera de 4 cm y plantilla ergonómica acolchada para máxima comodidad diaria.",
    category: "calzado",
    collection: "primavera-verano",
    price: 34.95,
    compareAtPrice: null,
    weightKg: 0.65,
    active: true,
    featured: true,
    order: 9,
    hasSizes: true,
    images: [
      "https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?auto=format&fit=crop&w=1080&q=82",
      "https://images.unsplash.com/photo-1549298916-b41d501d3772?auto=format&fit=crop&w=1080&q=82"
    ],
    colors: [
      {
        name: "Blanco",
        hex: "#ffffff",
        imageIndex: 0,
        sizes: [
          { size: "36", stock: 4 },
          { size: "37", stock: 5 },
          { size: "38", stock: 6 },
          { size: "39", stock: 5 },
          { size: "40", stock: 3 },
          { size: "41", stock: 2 }
        ]
      },
      {
        name: "Gris",
        hex: "#808080",
        imageIndex: 1,
        sizes: [
          { size: "36", stock: 2 },
          { size: "37", stock: 3 },
          { size: "38", stock: 4 },
          { size: "39", stock: 3 },
          { size: "40", stock: 2 },
          { size: "41", stock: 1 }
        ]
      }
    ]
  }
];

/**
 * A) NORMALIZADOR UNIVERSAL DE PRODUCTOS
 */
export function normalizeProductSchema(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const p = { ...raw };

  p.id = String(p.id || p.slug || ('prod-' + Math.random().toString(36).substring(2, 9)));
  p.slug = String(p.slug || p.id).toLowerCase().replace(/yoana-?zafiro/g, 'roneo-shop').replace(/zafiro/g, 'roneo').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  p.title = String(p.title || 'Prenda sin título').replace(/yoana\s*zafiro/gi, 'Roneo Shop').replace(/zafiro/gi, 'Roneo');
  p.description = String(p.description || '').replace(/yoana\s*zafiro/gi, 'Roneo Shop').replace(/zafiro/gi, 'Roneo');
  p.category = String(p.category || 'ropa').toLowerCase();
  p.collection = String(p.collection || 'novedades').toLowerCase();
  p.price = Number(p.price || 0);
  p.compareAtPrice = p.compareAtPrice ? Number(p.compareAtPrice) : null;
  p.weightKg = Number(p.weightKg || 0.35);
  p.active = p.active !== false;
  p.featured = Boolean(p.featured);
  p.order = typeof p.order === 'number' ? p.order : 0;
  p.createdAt = Number(p.createdAt || Date.now());

  // Normalizar array de imágenes y preview Base64
  if (!Array.isArray(p.images) || p.images.length === 0) {
    p.images = ["https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=1080&q=82"];
  }
  p.imagesPreviewBase64 = Array.isArray(p.imagesPreviewBase64) ? p.imagesPreviewBase64 : [];

  // 1. Determinar si maneja tallas
  const hasSizes = p.hasSizes !== undefined ? Boolean(p.hasSizes) : true;
  p.hasSizes = hasSizes;

  // 2. Tallas por defecto (según categoría)
  let defaultSizes = [{ size: "ÚNICA", stock: 10 }];
  if (hasSizes) {
    if (p.category === 'calzado') {
      defaultSizes = [
        { size: "36", stock: 3 },
        { size: "37", stock: 4 },
        { size: "38", stock: 5 },
        { size: "39", stock: 4 },
        { size: "40", stock: 2 }
      ];
    } else {
      defaultSizes = [
        { size: "XS", stock: 2 },
        { size: "S", stock: 4 },
        { size: "M", stock: 5 },
        { size: "L", stock: 3 },
        { size: "XL", stock: 1 }
      ];
    }
  }

  // 3. Normalizar array de colores
  if (Array.isArray(p.colors) && p.colors.length > 0) {
    p.colors = p.colors.map((c, idx) => {
      const colorName = String(c?.name || `Color ${idx + 1}`);
      const colorHex = String(c?.hex || '#121212');
      const imageIndex = Math.max(0, parseInt(c?.imageIndex, 10) || 0);

      let sizes = [];
      if (Array.isArray(c?.sizes) && c.sizes.length > 0) {
        sizes = c.sizes.map(s => ({
          size: String(s.size || 'ÚNICA').toUpperCase(),
          stock: Math.max(0, parseInt(s.stock, 10) || 0)
        }));
      } else if (Array.isArray(p.variants) && p.variants.length > 0) {
        sizes = p.variants.map(v => ({
          size: String(v.size || 'ÚNICA').toUpperCase(),
          stock: Math.max(0, parseInt(v.stock, 10) || 0)
        }));
      } else {
        sizes = defaultSizes.map(s => ({ ...s }));
      }

      const totalStock = sizes.reduce((sum, s) => sum + s.stock, 0);
      return {
        name: colorName,
        hex: colorHex,
        imageIndex,
        sizes,
        totalStock,
        inStock: totalStock > 0
      };
    });
  } else {
    // Si raw.colors está vacío
    let initialSizes = defaultSizes.map(s => ({ ...s }));
    if (Array.isArray(p.variants) && p.variants.length > 0) {
      initialSizes = p.variants.map(v => ({
        size: String(v.size || 'ÚNICA').toUpperCase(),
        stock: Math.max(0, parseInt(v.stock, 10) || 0)
      }));
    }
    const totalStock = initialSizes.reduce((sum, s) => sum + s.stock, 0);
    p.colors = [
      {
        name: "Estándar",
        hex: "#121212",
        imageIndex: 0,
        sizes: initialSizes,
        totalStock,
        inStock: totalStock > 0
      }
    ];
  }

  // 4. Recálculo automático de product.variants (resumen global por talla) y product.totalStock
  const sizeMap = new Map();
  p.colors.forEach(col => {
    col.sizes.forEach(s => {
      const cur = sizeMap.get(s.size) || 0;
      sizeMap.set(s.size, cur + s.stock);
    });
  });

  p.variants = Array.from(sizeMap.entries()).map(([size, stock]) => ({
    size,
    stock,
    sku: `${p.slug}-${size}`.toUpperCase()
  }));

  p.totalStock = p.colors.reduce((sum, c) => sum + (c.totalStock || 0), 0);
  p.inStock = p.totalStock > 0;

  return p;
}

export const normalizeProduct = normalizeProductSchema;

/**
 * Función de ordenación global canónica (order asc, createdAt desc)
 */
export function sortProductsCanonical(list) {
  return [...list].sort((a, b) => {
    const orderDiff = (a.order ?? 0) - (b.order ?? 0);
    if (orderDiff !== 0) return orderDiff;
    return (b.createdAt ?? 0) - (a.createdAt ?? 0);
  });
}

/**
 * Obtiene catálogo de respaldo guardado en localStorage
 */
function getLocalProductsFallback() {
  try {
    const raw = localStorage.getItem(STORAGE_PRODUCTS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return sortProductsCanonical(parsed.map(normalizeProductSchema));
      }
    }
  } catch (e) {
    console.error("[Store] Error leyendo caché local:", e);
  }
  return sortProductsCanonical(DEFAULT_CATALOG.map(normalizeProductSchema));
}

/**
 * Generadores de huella rápida para deduplicación estricta (Evita re-renderizados destructivos)
 */
export function computeProductsFingerprint(list) {
  if (!Array.isArray(list)) return "";
  return list.map(p => `${p.id}:${p.title}:${p.price}:${p.compareAtPrice}:${p.order}:${p.totalStock}:${(p.images && p.images[0]) || ''}`).join('|');
}

export function computeSettingsFingerprint(s) {
  if (!s) return "";
  return JSON.stringify({
    n: s.storeName,
    a: s.announcementText,
    hi: s.heroImage,
    ht: s.heroTitle,
    sh: s.shippingStandardPrice,
    fr: s.freeShippingThreshold,
    cat: s.categories,
    col: s.collections
  });
}

/**
 * B) CLASE SINGLETON STORE CON ONSNAPSHOT
 */
class Store {
  constructor() {
    this.subscribers = [];
    this.settingsSubscribers = [];
    this.ordersSubscribers = [];
    this.initialized = false;
    this.products = [];
    this.orders = [];
    this._seeding = false;
    this._purged = false;
    this._hasEmittedProductsOnce = false;
    this._hasEmittedSettingsOnce = false;

    // Cargar datos inmediatos de configuración desde localStorage para cero parpadeo
    try {
      const savedSet = localStorage.getItem('store_db_settings_v10') || localStorage.getItem(STORAGE_SETTINGS_KEY);
      this.settings = savedSet ? normalizeSettingsSchema(JSON.parse(savedSet)) : normalizeSettingsSchema(MOCK_SETTINGS);
      if (this.settings.heroImage && !this.settings.heroImage.includes('unsplash.com')) {
        localStorage.setItem('roneo_hero_image_v1', this.settings.heroImage);
      } else {
        localStorage.removeItem('roneo_hero_image_v1');
      }
    } catch (e) {
      this.settings = normalizeSettingsSchema(MOCK_SETTINGS);
    }

    this._lastProductsHash = "";
    this._lastSettingsHash = computeSettingsFingerprint(this.settings);
  }

  init() {
    if (this.initialized) return;
    this.initialized = true;

    // Purga inmediata de claves locales con datos obsoletos del remitente
    try {
      const keysToCheck = ['store_db_settings_v10', STORAGE_SETTINGS_KEY, 'roneo_sender_address'];
      for (const k of keysToCheck) {
        const val = localStorage.getItem(k);
        if (val && /calle principal|29001|m[aá]laga|600000000|info@roneoshop/i.test(val)) {
          localStorage.removeItem(k);
        }
      }
    } catch (e) {}

    // Forzar actualización inmediata en Firestore del remitente fijo inmutable (Nerea Cortes Muñoz, Torredonjimeno 23650)
    try {
      setDoc(doc(db, 'settings', 'store_config'), sanitizeForFirestore({
        senderAddress: FIXED_SENDER_ADDRESS,
        senderName: FIXED_SENDER_ADDRESS.fullName,
        senderCompany: FIXED_SENDER_ADDRESS.company,
        senderStreet: FIXED_SENDER_ADDRESS.street1,
        senderZip: FIXED_SENDER_ADDRESS.zip_code,
        senderCity: FIXED_SENDER_ADDRESS.city,
        senderProvince: FIXED_SENDER_ADDRESS.province,
        senderPhone: FIXED_SENDER_ADDRESS.phone,
        senderEmail: FIXED_SENDER_ADDRESS.email,
        contactEmail: FIXED_SENDER_ADDRESS.email,
        contactPhone: FIXED_SENDER_ADDRESS.phoneFormatted
      }), { merge: true }).catch(() => {});
    } catch (e) {}

    // Cargar datos inmediatos de caché para UI instantánea
    this.products = getLocalProductsFallback();
    this._lastProductsHash = computeProductsFingerprint(this.products);
    try {
      const savedSet = localStorage.getItem('store_db_settings_v10') || localStorage.getItem(STORAGE_SETTINGS_KEY);
      this.settings = savedSet ? normalizeSettingsSchema(JSON.parse(savedSet)) : normalizeSettingsSchema(MOCK_SETTINGS);
      if (this.settings.heroImage && !this.settings.heroImage.includes('unsplash.com')) {
        localStorage.setItem('roneo_hero_image_v1', this.settings.heroImage);
      } else {
        localStorage.removeItem('roneo_hero_image_v1');
      }
      this._lastSettingsHash = computeSettingsFingerprint(this.settings);
      const savedOrd = localStorage.getItem(STORAGE_ORDERS_KEY);
      this.orders = savedOrd ? JSON.parse(savedOrd) : [];
    } catch (e) {
      this.settings = normalizeSettingsSchema(MOCK_SETTINGS);
    }

    // 1. Listener en tiempo real para 'products'
    const colRef = collection(db, 'products');
    onSnapshot(colRef, async (snapshot) => {
      if (snapshot.empty && !this._seeding) {
        this._seeding = true;
        await syncAllToFirestore({ forceOverwrite: true });
        this._seeding = false;
        return;
      }
      const list = [];
      snapshot.forEach((docSnap) => {
        list.push(normalizeProductSchema({ id: docSnap.id, ...docSnap.data() }));
      });

      // Ordenar con criterio canónico estricto
      const sorted = sortProductsCanonical(list);
      const newHash = computeProductsFingerprint(sorted);

      // Deduplicación por huella: si los productos no cambiaron y ya se emitió una vez, no tocar el DOM
      if (newHash === this._lastProductsHash && this._hasEmittedProductsOnce) {
        return;
      }
      this._lastProductsHash = newHash;
      this._hasEmittedProductsOnce = true;
      this.products = sorted;
      localStorage.setItem(STORAGE_PRODUCTS_KEY, JSON.stringify(sorted));
      this.notifySubscribers(sorted);

      // Purga automática de categorías obsoletas si aún no se ha ejecutado
      if (!this._purged) {
        this._purged = true;
        purgeDeprecatedCategoriesInFirestore(list).catch(() => {});
      }
    }, (err) => {
      console.warn("[Store onSnapshot Fallback - Usando local]:", err?.message || err);
      const fallback = getLocalProductsFallback();
      this.products = fallback;
      this.notifySubscribers(fallback);
    });

    // 2. Listener en tiempo real para 'settings/store_config'
    try {
      onSnapshot(doc(db, 'settings', 'store_config'), async (docSnap) => {
        if (!docSnap.exists()) {
          try {
            await setDoc(doc(db, 'settings', 'store_config'), sanitizeForFirestore(MOCK_SETTINGS));
            this.settings = normalizeSettingsSchema(MOCK_SETTINGS);
          } catch (e) {
            this.settings = normalizeSettingsSchema(MOCK_SETTINGS);
          }
        } else {
          const rawDoc = docSnap.data();
          const normalized = normalizeSettingsSchema(rawDoc);
          this.settings = normalized;
          // Sanitización automática y persistencia de Packlink API Key oficial en Firestore
          const needsBrandSanitize = rawDoc && (
            /yoana|zafiro/i.test(rawDoc.storeName || '') ||
            /yoana|zafiro/i.test(rawDoc.heroTitle || '') ||
            /yoanazafiro/i.test(rawDoc.contactEmail || '') ||
            /yoana|zafiro/i.test(rawDoc.senderName || '')
          );
          const needsPacklinkKey = !rawDoc?.packlinkApiKey || rawDoc.packlinkApiKey.trim().length < 20;

          if (needsBrandSanitize || needsPacklinkKey) {
            try {
              await updateDoc(doc(db, 'settings', 'store_config'), sanitizeForFirestore({
                ...rawDoc,
                storeName: normalized.storeName,
                heroTitle: normalized.heroTitle,
                contactEmail: normalized.contactEmail,
                senderName: normalized.senderName,
                senderCompany: normalized.senderCompany,
                senderEmail: normalized.senderEmail,
                senderAddress: normalized.senderAddress,
                packlinkApiKey: normalized.packlinkApiKey,
                packlinkAutoSync: normalized.packlinkAutoSync,
                packlinkParcel: normalized.packlinkParcel
              }));
              console.info("[Store Auto-Sanitizer] Configuración en Firestore sincronizada con Packlink PRO y Roneo Shop.");
            } catch (err) {
              console.warn("[Store Auto-Sanitizer Error]:", err);
            }
          }
        }

        if (this.settings.heroImage && !this.settings.heroImage.includes('unsplash.com')) {
          localStorage.setItem('roneo_hero_image_v1', this.settings.heroImage);
        } else {
          localStorage.removeItem('roneo_hero_image_v1');
        }
        localStorage.setItem(STORAGE_SETTINGS_KEY, JSON.stringify(this.settings));
        localStorage.setItem('store_db_settings_v10', JSON.stringify(this.settings));

        const newSettingsHash = computeSettingsFingerprint(this.settings);
        if (newSettingsHash === this._lastSettingsHash && this._hasEmittedSettingsOnce) {
          return;
        }
        this._lastSettingsHash = newSettingsHash;
        this._hasEmittedSettingsOnce = true;

        this.settingsSubscribers.forEach(cb => {
          try { cb(this.settings); } catch (e) { console.error(e); }
        });
      }, (err) => {
        console.warn("[settings onSnapshot error - usando fallback]:", err);
      });
    } catch (e) {}

    // Sincronización en vivo entre pestañas
    try {
      const channel = new BroadcastChannel('roneoshop_live_sync');
      channel.onmessage = (event) => {
        if (event.data?.type === 'SETTINGS_UPDATED' && event.data.settings) {
          this.settings = normalizeSettingsSchema(event.data.settings);
          this.settingsSubscribers.forEach(cb => {
            try { cb(this.settings); } catch (e) {}
          });
        }
      };
    } catch (e) {}

    // 3. Listener en tiempo real para 'orders'
    try {
      onSnapshot(collection(db, 'orders'), (snapshot) => {
        const ordList = [];
        snapshot.forEach((d) => ordList.push({ orderNumber: d.id, ...d.data() }));
        ordList.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        this.orders = ordList;
        localStorage.setItem(STORAGE_ORDERS_KEY, JSON.stringify(ordList));
        this.ordersSubscribers.forEach(cb => {
          try { cb(ordList); } catch (e) { console.error(e); }
        });
      }, () => {});
    } catch (e) {}
  }

  subscribe(callback) {
    if (typeof callback !== 'function') return () => {};
    this.subscribers.push(callback);
    if (this.products && this.products.length > 0) {
      try { callback(this.products); } catch (e) { console.error(e); }
    }
    if (!this.initialized) this.init();
    return () => { this.subscribers = this.subscribers.filter(cb => cb !== callback); };
  }

  subscribeSettings(callback) {
    if (typeof callback !== 'function') return () => {};
    this.settingsSubscribers.push(callback);
    if (this.settings) {
      try { callback(this.settings); } catch (e) { console.error(e); }
    }
    if (!this.initialized) this.init();
    return () => { this.settingsSubscribers = this.settingsSubscribers.filter(cb => cb !== callback); };
  }

  subscribeOrders(callback) {
    if (typeof callback !== 'function') return () => {};
    this.ordersSubscribers.push(callback);
    if (this.orders && this.orders.length > 0) {
      try { callback(this.orders); } catch (e) { console.error(e); }
    }
    if (!this.initialized) this.init();
    return () => { this.ordersSubscribers = this.ordersSubscribers.filter(cb => cb !== callback); };
  }

  notifySubscribers(products) {
    this.subscribers.forEach(cb => {
      try { cb(products); } catch (e) { console.error(e); }
    });
  }
}

export const store = new Store();
export default store;

/**
 * PURGA AUTOMÁTICA EN FIRESTORE DE CATEGORÍAS OBSOLETAS
 * Elimina 'cabello', 'cosmetica' y 'peikas' y sube el calzado oficial
 */
export async function purgeDeprecatedCategoriesInFirestore(currentList = []) {
  try {
    const deprecated = ['cabello', 'cosmetica', 'peikas'];
    const toDelete = currentList.filter(p => deprecated.includes(p.category));

    if (toDelete.length > 0) {
      const batch = writeBatch(db);
      toDelete.forEach(p => {
        batch.delete(doc(db, 'products', p.id));
      });
      await batch.commit();
      console.log(`[Store] Purgados ${toDelete.length} productos obsoletos de Firestore.`);
    }

    // Verificar si existen los productos de calzado oficial
    const hasChelsea = currentList.some(p => p.id === 'botin-chelsea-piel-negro');
    if (!hasChelsea) {
      const batchCalzado = writeBatch(db);
      const calzadoItems = DEFAULT_CATALOG.filter(p => p.category === 'calzado');
      calzadoItems.forEach(prod => {
        const refDoc = doc(db, 'products', prod.id);
        batchCalzado.set(refDoc, sanitizeForFirestore(normalizeProductSchema(prod)));
      });
      await batchCalzado.commit();
      console.log("[Store] Subida línea de calzado oficial a Firestore.");
    }

    // Actualizar configuración de categorías en settings si fuera necesario
    const settingsDoc = await getDoc(doc(db, 'settings', 'store_config'));
    if (settingsDoc.exists()) {
      const sData = settingsDoc.data();
      const existingCats = Array.isArray(sData?.categories) ? sData.categories : [];
      const hasDeprecated = existingCats.some(c => deprecated.includes(c.id || c.slug));
      const hasCalzado = existingCats.some(c => (c.id || c.slug) === 'calzado');

      if (hasDeprecated || !hasCalzado) {
        const cleaned = existingCats.filter(c => !deprecated.includes(c.id || c.slug));
        if (!cleaned.some(c => (c.id || c.slug) === 'calzado')) {
          cleaned.splice(1, 0, { id: "calzado", name: "Calzado", slug: "calzado", order: 1, isPlaceholder: false });
        }
        if (!cleaned.some(c => (c.id || c.slug) === 'mas-proximamente')) {
          cleaned.push({ id: "mas-proximamente", name: "Más próximamente...", slug: "mas-proximamente", order: cleaned.length, isPlaceholder: true });
        }
        await updateDoc(doc(db, 'settings', 'store_config'), { categories: cleaned });
      }
    }
  } catch (err) {
    console.warn("[Store purgeDeprecatedCategoriesInFirestore Error]:", err?.message || err);
  }
}

/**
 * C) GESTOR DINÁMICO DE CATEGORÍAS
 */
export async function getCategories() {
  if (store.settings?.categories && store.settings.categories.length > 0) {
    return store.settings.categories;
  }
  return DEFAULT_CATEGORIES;
}

export async function addCategory(name) {
  if (!name || typeof name !== 'string') return null;
  const cleanName = name.trim();
  const slug = cleanName
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  const currentCats = [...(await getCategories())];
  if (currentCats.some(c => c.slug === slug || c.id === slug)) {
    throw new Error(`La categoría "${cleanName}" ya existe.`);
  }

  // Insertar justo antes de "Más próximamente..." si existe
  const newCat = {
    id: slug,
    name: cleanName,
    slug: slug,
    order: currentCats.length,
    isPlaceholder: false
  };

  const placeholderIdx = currentCats.findIndex(c => c.isPlaceholder || c.slug === 'mas-proximamente');
  if (placeholderIdx >= 0) {
    currentCats.splice(placeholderIdx, 0, newCat);
  } else {
    currentCats.push(newCat);
  }

  // Recalcular orden numérico
  currentCats.forEach((c, i) => { c.order = i; });

  await saveStoreSettings({ categories: currentCats });
  return newCat;
}

export async function deleteCategory(categoryId) {
  const currentCats = [...(await getCategories())];
  const filtered = currentCats.filter(c => c.id !== categoryId && c.slug !== categoryId);
  filtered.forEach((c, i) => { c.order = i; });
  await saveStoreSettings({ categories: filtered });
  return filtered;
}

export async function renameCategory(categoryId, newName) {
  if (!newName) return;
  const currentCats = [...(await getCategories())];
  const found = currentCats.find(c => c.id === categoryId || c.slug === categoryId);
  if (found) {
    found.name = newName.trim();
    await saveStoreSettings({ categories: currentCats });
  }
  return currentCats;
}

export async function reorderCategories(categoriesList) {
  if (!Array.isArray(categoriesList)) return;
  categoriesList.forEach((c, i) => { c.order = i; });
  await saveStoreSettings({ categories: categoriesList });
  return categoriesList;
}

/**
 * D) CONVERSIÓN Y SUBIDA DE IMÁGENES (ESTILO JVELOCE)
 */
export function dataURItoBlob(dataURI) {
  if (!dataURI || typeof dataURI !== 'string') return null;
  if (dataURI.startsWith('http://') || dataURI.startsWith('https://') || dataURI.startsWith('/')) {
    return null;
  }
  if (!dataURI.startsWith('data:')) {
    return null;
  }

  try {
    const parts = dataURI.split(',');
    const mimeMatch = parts[0].match(/:(.*?);/);
    const mimeString = mimeMatch ? mimeMatch[1] : 'image/webp';
    const byteString = atob(parts[1]);
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i);
    }
    return new Blob([ab], { type: mimeString });
  } catch (err) {
    console.error("[dataURItoBlob] Error al convertir base64 a Blob:", err);
    return null;
  }
}

/**
 * ============================================================================
 * CAPA 1: ALMACÉN LOCAL PERSISTENTE EN INDEXEDDB (roneoshop_media_cache_v1)
 * ============================================================================
 */
const IDB_NAME = 'roneoshop_media_cache_v1';
const IDB_STORE = 'media_cache';
const IDB_VERSION = 1;

let _idbPromise = null;
function getMediaCacheDB() {
  if (_idbPromise) return _idbPromise;
  _idbPromise = new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') {
      resolve(null);
      return;
    }
    const request = indexedDB.open(IDB_NAME, IDB_VERSION);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE, { keyPath: 'key' });
      }
    };
    request.onsuccess = (e) => {
      resolve(e.target.result);
    };
    request.onerror = (e) => {
      console.warn("[IndexedDB] Error abriendo media cache:", e);
      resolve(null);
    };
  });
  return _idbPromise;
}

export async function saveImageBase64ToLocalCache(keyOrUrl, base64DataUrl) {
  if (!keyOrUrl || !base64DataUrl || typeof base64DataUrl !== 'string') return;
  try {
    const db = await getMediaCacheDB();
    if (!db) return;
    return new Promise((resolve) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      const store = tx.objectStore(IDB_STORE);
      store.put({ key: String(keyOrUrl), dataUrl: base64DataUrl, updatedAt: Date.now() });
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  } catch (err) {
    console.warn("[saveImageBase64ToLocalCache] Error:", err);
  }
}

export async function getImageBase64FromLocalCache(keyOrUrl) {
  if (!keyOrUrl) return null;
  try {
    const db = await getMediaCacheDB();
    if (!db) return null;
    return new Promise((resolve) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const store = tx.objectStore(IDB_STORE);
      const req = store.get(String(keyOrUrl));
      req.onsuccess = () => {
        resolve(req.result ? req.result.dataUrl : null);
      };
      req.onerror = () => resolve(null);
    });
  } catch (err) {
    console.warn("[getImageBase64FromLocalCache] Error:", err);
    return null;
  }
}

export function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    if (!blob) {
      resolve(null);
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export async function compressDataUriToWebpBlob(dataURI, maxWidth = 1080, maxHeight = 1440, quality = 0.84) {
  return new Promise((resolve) => {
    if (!dataURI || typeof dataURI !== 'string') {
      resolve(null);
      return;
    }

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      let width = img.naturalWidth || img.width;
      let height = img.naturalHeight || img.height;

      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }
      if (height > maxHeight) {
        width = Math.round((width * maxHeight) / height);
        height = maxHeight;
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob((blob) => {
        resolve(blob);
      }, 'image/webp', quality);
    };

    img.onerror = () => {
      const rawBlob = dataURItoBlob(dataURI);
      resolve(rawBlob);
    };

    img.src = dataURI;
  });
}

export const imageSourceToWebpBlob = compressDataUriToWebpBlob;
export const fileOrUrlToWebpBlob = compressDataUriToWebpBlob;

export async function uploadProductImage(imageSource, productId, index = 0) {
  if (!imageSource) return '';

  if (imageSource.startsWith('https://firebasestorage.googleapis.com/')) {
    return imageSource;
  }

  if (imageSource.startsWith('data:')) {
    try {
      const webpBlob = await compressDataUriToWebpBlob(imageSource, 1080, 1440, 0.84);
      if (!webpBlob) return imageSource;

      const safeId = String(productId || 'prod').replace(/[^a-z0-9_-]/gi, '-');
      const storagePath = `products/${safeId}/${index + 1}.webp`;
      const storageRef = ref(storage, storagePath);

      await uploadBytes(storageRef, webpBlob, {
        contentType: 'image/webp',
        cacheControl: 'public, max-age=31536000'
      });

      const downloadURL = await getDownloadURL(storageRef);
      const versionedUrl = `${downloadURL}?v=${Date.now()}`;

      // Guardar inmediatamente en caché IndexedDB
      await saveImageBase64ToLocalCache(versionedUrl, imageSource);
      await saveImageBase64ToLocalCache(downloadURL, imageSource);
      if (productId) {
        await saveImageBase64ToLocalCache(`${productId}_${index}`, imageSource);
      }

      return versionedUrl;
    } catch (err) {
      console.warn("[uploadProductImage] Error al subir a Storage, conservando dataURI:", err);
      return imageSource;
    }
  }

  return imageSource;
}

export async function migrateAllImagesToFirebaseStorage(onProgress = null) {
  const products = await getProducts();
  let totalImages = 0;
  let migratedImages = 0;

  products.forEach(p => {
    if (Array.isArray(p.images)) totalImages += p.images.length;
  });

  for (const product of products) {
    let modified = false;
    const newImages = [];

    for (let i = 0; i < (product.images || []).length; i++) {
      const img = product.images[i];
      if (img && !img.startsWith('https://firebasestorage.googleapis.com/')) {
        try {
          const uploadedUrl = await uploadProductImage(img, product.id, i);
          newImages.push(uploadedUrl);
          modified = true;
        } catch (e) {
          newImages.push(img);
        }
      } else {
        newImages.push(img);
      }
      migratedImages++;
      if (typeof onProgress === 'function') {
        onProgress(migratedImages, totalImages);
      }
    }

    if (modified) {
      product.images = newImages;
      await saveProduct(product);
    }
  }

  return { totalImages, migratedImages };
}

/**
 * E) FUNCIONES OBLIGATORIAS DEL CONTRATO
 */

export function subscribeToProducts(cb) {
  return store.subscribe(cb);
}

export function subscribeToSettings(cb) {
  return store.subscribeSettings(cb);
}

export function subscribeToOrders(cb) {
  return store.subscribeOrders(cb);
}

export const onStoreDataChanged = subscribeToProducts;

export function subscribeToProductById(productId, cb) {
  return store.subscribe((all) => {
    const found = all.find(p => p.id === productId || p.slug === productId);
    if (found) cb(found);
  });
}

export async function getProducts(opts = {}) {
  if (!store.initialized) store.init();
  if (store.products && store.products.length > 0) {
    return sortProductsCanonical(store.products);
  }
  try {
    const snapshot = await getDocs(collection(db, 'products'));
    if (!snapshot.empty) {
      const list = [];
      snapshot.forEach(d => list.push(normalizeProductSchema({ id: d.id, ...d.data() })));
      const sorted = sortProductsCanonical(list);
      store.products = sorted;
      return sorted;
    }
  } catch (e) {
    console.warn("[getProducts] Usando caché local:", e);
  }
  return getLocalProductsFallback();
}

export async function getProductByIdOrSlug(idOrSlug) {
  if (!idOrSlug) return null;
  const list = await getProducts();
  return list.find(p => p.id === idOrSlug || p.slug === idOrSlug) || null;
}

export async function getProductsByFilter(filters = {}) {
  const all = await getProducts();
  let list = all.filter(p => {
    if (!p.active) return false;
    if (filters.category && filters.category !== 'all' && filters.category !== 'todos') {
      const cat = filters.category.toLowerCase();
      const inTags = Array.isArray(p.collectionTags) && p.collectionTags.some(t => String(t).toLowerCase() === cat);
      if ((p.category || '').toLowerCase() !== cat && (p.collection || '').toLowerCase() !== cat && !inTags) return false;
    }
    if (filters.search) {
      const q = filters.search.toLowerCase();
      const matchTitle = (p.title || '').toLowerCase().includes(q);
      const matchDesc = (p.description || '').toLowerCase().includes(q);
      const matchCat = (p.category || '').toLowerCase().includes(q);
      if (!matchTitle && !matchDesc && !matchCat) return false;
    }
    if (filters.onlyInStock && p.totalStock <= 0) return false;
    if (filters.size) {
      const hasSize = (p.variants || []).some(v => v.size === filters.size && v.stock > 0);
      if (!hasSize) return false;
    }
    if (filters.minPrice && p.price < filters.minPrice) return false;
    if (filters.maxPrice && p.price > filters.maxPrice) return false;
    return true;
  });

  if (filters.sortBy) {
    if (filters.sortBy === 'price-asc') list.sort((a, b) => a.price - b.price);
    else if (filters.sortBy === 'price-desc') list.sort((a, b) => b.price - a.price);
    else if (filters.sortBy === 'title-asc') list.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
    else if (filters.sortBy === 'featured') list = sortProductsCanonical(list);
  } else {
    list = sortProductsCanonical(list);
  }

  return list;
}

export async function getRelatedProducts(currentProductId, categoryOrLimit, limitCount = 4) {
  let category = null;
  let count = limitCount;
  if (typeof categoryOrLimit === 'number') {
    count = categoryOrLimit;
  } else if (typeof categoryOrLimit === 'string') {
    category = categoryOrLimit;
  }
  const all = await getProducts();
  const activeProducts = all.filter(p => p.id !== currentProductId && p.active !== false);

  // 1. Priorizar prendas de la misma categoría
  const sameCat = category ? activeProducts.filter(p => p.category === category) : [];

  // 2. Si hay menos de count, completar con el resto del catálogo para que nunca quede vacío
  const otherCats = activeProducts.filter(p => !sameCat.some(sc => sc.id === p.id));
  const combined = [...sameCat, ...otherCats];

  return combined.slice(0, count);
}

/**
 * PUNTO 1: LÓGICA ESTRICTA DE POSICIÓN (order) AL EDITAR VS. PUBLICAR NUEVA PRENDA
 */
export async function saveProduct(productData) {
  const normalized = normalizeProductSchema(productData);
  if (!normalized) throw new Error("Datos de producto inválidos");

  // 1. Comprobación de existencia previa
  const existingProduct = store.products.find(p => p.id === normalized.id);

  if (existingProduct) {
    // CASO A — EDICIÓN: Respeta exactamente su posición y fecha de creación previa
    normalized.order = (typeof existingProduct.order === 'number') ? existingProduct.order : 0;
    normalized.createdAt = existingProduct.createdAt || normalized.createdAt || Date.now();
  } else {
    // CASO B — PRENDA NUEVA: Debe aparecer arriba del todo (order más bajo)
    const existingOrders = store.products.map(p => (typeof p.order === 'number' ? p.order : 0));
    const minOrder = existingOrders.length > 0 ? Math.min(...existingOrders) : 1;
    normalized.order = minOrder - 1;
    normalized.createdAt = Date.now();
  }

  // Procesar imágenes: subir las que sean base64 dataURI y respaldar preview ligera
  const processedImages = [];
  const previewBase64 = Array.isArray(normalized.imagesPreviewBase64) ? [...normalized.imagesPreviewBase64] : [];

  for (let i = 0; i < (normalized.images || []).length; i++) {
    const imgSource = normalized.images[i];
    if (imgSource && imgSource.startsWith('data:')) {
      // Guardar versión ligera WebP (máx 900px, calidad 0.78, ~35KB) para Firestore
      try {
        const lightBlob = await compressDataUriToWebpBlob(imgSource, 600, 900, 0.78);
        if (lightBlob) {
          const lightDataUrl = await blobToDataUrl(lightBlob);
          previewBase64[i] = lightDataUrl;
        }
      } catch (e) {}

      // Cachear en IndexedDB por id e índice
      await saveImageBase64ToLocalCache(`${normalized.id}_${i}`, imgSource);

      const uploadedUrl = await uploadProductImage(imgSource, normalized.id, i);
      processedImages.push(uploadedUrl);
      if (uploadedUrl && uploadedUrl.startsWith('http')) {
        await saveImageBase64ToLocalCache(uploadedUrl, imgSource);
      }
    } else {
      processedImages.push(imgSource);
    }
  }
  normalized.images = processedImages;
  normalized.imagesPreviewBase64 = previewBase64;

  // Guardar en Firestore con saneador estricto
  const docRef = doc(db, 'products', normalized.id);
  await setDoc(docRef, sanitizeForFirestore(normalized), { merge: true });

  // Actualizar caché local
  const currentList = [...store.products];
  const idx = currentList.findIndex(p => p.id === normalized.id);
  if (idx >= 0) {
    currentList[idx] = normalized;
  } else {
    currentList.push(normalized);
  }

  const sorted = sortProductsCanonical(currentList);
  store.products = sorted;
  localStorage.setItem(STORAGE_PRODUCTS_KEY, JSON.stringify(sorted));
  store.notifySubscribers(sorted);

  return normalized;
}

export async function deleteProduct(productId) {
  if (!productId) return false;
  try {
    await deleteDoc(doc(db, 'products', productId));
  } catch (err) {
    console.warn("[deleteProduct] Error Firestore:", err);
  }

  const updated = store.products.filter(p => p.id !== productId);
  store.products = updated;
  localStorage.setItem(STORAGE_PRODUCTS_KEY, JSON.stringify(updated));
  store.notifySubscribers(updated);
  return true;
}

export async function reorderProducts(orderedProducts) {
  if (!Array.isArray(orderedProducts)) return false;

  const batch = writeBatch(db);
  orderedProducts.forEach((prod, index) => {
    prod.order = index;
    const refDoc = doc(db, 'products', prod.id);
    batch.update(refDoc, { order: index });
  });

  try {
    await batch.commit();
  } catch (err) {
    console.warn("[reorderProducts] Fallo en writeBatch Firestore:", err);
  }

  store.products = [...orderedProducts];
  localStorage.setItem(STORAGE_PRODUCTS_KEY, JSON.stringify(orderedProducts));
  store.notifySubscribers(store.products);
  return true;
}

export async function updateProductStockAfterOrder(orderItems) {
  if (!Array.isArray(orderItems) || orderItems.length === 0) return;

  for (const item of orderItems) {
    const product = await getProductByIdOrSlug(item.productId || item.id);
    if (!product) continue;

    const boughtQty = Number(item.quantity) || 1;
    const boughtSize = String(item.size || 'ÚNICA').toUpperCase();
    const boughtColor = String(item.color || item.colorName || '').toLowerCase();

    let colorFound = product.colors.find(c => (c.name || '').toLowerCase() === boughtColor);
    if (!colorFound && product.colors.length > 0) {
      colorFound = product.colors[0];
    }

    if (colorFound && Array.isArray(colorFound.sizes)) {
      const sizeObj = colorFound.sizes.find(s => s.size === boughtSize);
      if (sizeObj) {
        sizeObj.stock = Math.max(0, sizeObj.stock - boughtQty);
      }
    }

    const updated = normalizeProductSchema(product);
    await saveProduct(updated);
  }
}

export async function getStoreSettings() {
  if (store.settings) return store.settings;
  try {
    const docSnap = await getDoc(doc(db, 'settings', 'store_config'));
    if (docSnap.exists()) {
      store.settings = normalizeSettingsSchema(docSnap.data());
      return store.settings;
    }
  } catch (e) {}
  store.settings = normalizeSettingsSchema(MOCK_SETTINGS);
  return store.settings;
}

export async function saveStoreSettings(partialOrFullSettings) {
  const current = store.settings || await getStoreSettings();
  const merged = normalizeSettingsSchema({
    ...current,
    ...partialOrFullSettings,
    senderAddress: {
      ...(current.senderAddress || {}),
      ...(partialOrFullSettings?.senderAddress || {})
    },
    categories: partialOrFullSettings?.categories || current.categories,
    collections: partialOrFullSettings?.collections || current.collections,
    updatedAt: Date.now()
  });

  // Si heroImage es Base64 data:, comprimir y subir a Storage
  if (merged.heroImage && merged.heroImage.startsWith('data:image/')) {
    try {
      const blob = await compressDataUriToWebpBlob(merged.heroImage, 1200, 1600, 0.85);
      const storageRef = ref(storage, `settings/hero_${Date.now()}.webp`);
      await uploadBytes(storageRef, blob, { contentType: 'image/webp' });
      merged.heroImage = await getDownloadURL(storageRef);
    } catch (e) {
      console.warn("[saveStoreSettings] Error subiendo heroImage:", e);
    }
  }

  // Si alguna imagen de collections es Base64 data:, subir a Storage
  if (Array.isArray(merged.collections)) {
    for (const col of merged.collections) {
      if (col.image && col.image.startsWith('data:image/')) {
        try {
          const blob = await compressDataUriToWebpBlob(col.image, 800, 1066, 0.82);
          const storageRef = ref(storage, `collections/${col.slug || 'col'}_${Date.now()}.webp`);
          await uploadBytes(storageRef, blob, { contentType: 'image/webp' });
          col.image = await getDownloadURL(storageRef);
        } catch (e) {
          console.warn("[saveStoreSettings] Error subiendo foto de colección:", e);
        }
      }
    }
  }

  try {
    await setDoc(doc(db, 'settings', 'store_config'), sanitizeForFirestore(merged), { merge: true });
  } catch (e) {
    console.warn("[saveStoreSettings] Error guardando en Firestore:", e);
  }

  store.settings = merged;
  if (merged.heroImage && !merged.heroImage.includes('unsplash.com')) {
    localStorage.setItem('roneo_hero_image_v1', merged.heroImage);
  } else {
    localStorage.removeItem('roneo_hero_image_v1');
  }
  localStorage.setItem(STORAGE_SETTINGS_KEY, JSON.stringify(merged));
  localStorage.setItem('store_db_settings_v10', JSON.stringify(merged));

  store.settingsSubscribers.forEach(cb => {
    try { cb(merged); } catch (e) { console.error(e); }
  });

  try {
    const channel = new BroadcastChannel('roneoshop_live_sync');
    channel.postMessage({ type: 'SETTINGS_UPDATED', settings: merged });
    channel.close();
  } catch (e) {}

  return merged;
}

/**
 * GESTIÓN DE COLECCIONES DE LA TIENDA (CRUD)
 */
export function getCollections() {
  const list = store.settings?.collections || DEFAULT_COLLECTIONS;
  return [...list].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

export async function saveCollection(collectionData) {
  if (!collectionData || !collectionData.title) throw new Error("Título de colección requerido");

  const currentSettings = store.settings || await getStoreSettings();
  const currentCols = [...(currentSettings.collections || DEFAULT_COLLECTIONS)];

  const slug = (collectionData.slug || collectionData.title)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  const id = collectionData.id || slug;

  let imageUrl = collectionData.image || '';
  if (imageUrl.startsWith('data:image/')) {
    try {
      const blob = await compressDataUriToWebpBlob(imageUrl, 800, 1066, 0.82);
      const storageRef = ref(storage, `collections/${slug}_${Date.now()}.webp`);
      await uploadBytes(storageRef, blob, { contentType: 'image/webp' });
      imageUrl = await getDownloadURL(storageRef);
    } catch (e) {
      console.warn("[saveCollection] Error subiendo imagen a Storage:", e);
    }
  }

  const existingIdx = currentCols.findIndex(c => c.id === id || c.slug === slug);
  const colObj = {
    id,
    slug,
    title: collectionData.title.trim(),
    subtitle: (collectionData.subtitle || '').trim(),
    image: imageUrl,
    order: typeof collectionData.order === 'number' ? collectionData.order : (existingIdx >= 0 ? (currentCols[existingIdx].order ?? existingIdx) : currentCols.length),
    active: collectionData.active !== false
  };

  if (existingIdx >= 0) {
    currentCols[existingIdx] = { ...currentCols[existingIdx], ...colObj };
  } else {
    currentCols.push(colObj);
  }

  currentCols.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  currentCols.forEach((c, idx) => { c.order = idx; });

  await saveStoreSettings({ collections: currentCols });
  return colObj;
}

export async function deleteCollection(collectionId) {
  const currentSettings = store.settings || await getStoreSettings();
  const currentCols = [...(currentSettings.collections || DEFAULT_COLLECTIONS)];
  const filtered = currentCols.filter(c => c.id !== collectionId && c.slug !== collectionId);
  filtered.forEach((c, idx) => { c.order = idx; });
  await saveStoreSettings({ collections: filtered });
  return filtered;
}

export async function reorderCollections(orderedIds) {
  if (!Array.isArray(orderedIds)) return;
  const currentSettings = store.settings || await getStoreSettings();
  const currentCols = [...(currentSettings.collections || DEFAULT_COLLECTIONS)];

  const reordered = [];
  orderedIds.forEach((id, idx) => {
    const found = currentCols.find(c => c.id === id || c.slug === id);
    if (found) {
      found.order = idx;
      reordered.push(found);
    }
  });

  currentCols.forEach(c => {
    if (!reordered.some(r => r.id === c.id)) {
      c.order = reordered.length;
      reordered.push(c);
    }
  });

  await saveStoreSettings({ collections: reordered });
  return reordered;
}

/**
 * Actualiza los collectionTags y collection de un conjunto de productos en Firestore
 * mediante writeBatch para que se sincronice en vivo de forma atómica y sin costes extra.
 */
export async function updateProductsCollectionTags(collectionSlug, productIdsToAdd = [], productIdsToRemove = []) {
  if (!collectionSlug) return;
  const cleanSlug = collectionSlug.toLowerCase().trim();
  const batch = writeBatch(db);
  let hasOps = false;

  const currentProducts = store.products || [];

  productIdsToAdd.forEach(pId => {
    const prod = currentProducts.find(p => p.id === pId);
    if (prod) {
      const currentTags = Array.isArray(prod.collectionTags) ? [...prod.collectionTags] : [];
      if (!currentTags.includes(cleanSlug)) {
        currentTags.push(cleanSlug);
        batch.update(doc(db, 'products', pId), {
          collectionTags: currentTags,
          collection: cleanSlug
        });
        prod.collectionTags = currentTags;
        prod.collection = cleanSlug;
        hasOps = true;
      }
    }
  });

  productIdsToRemove.forEach(pId => {
    const prod = currentProducts.find(p => p.id === pId);
    if (prod) {
      const currentTags = Array.isArray(prod.collectionTags) ? [...prod.collectionTags] : [];
      if (currentTags.includes(cleanSlug)) {
        const filteredTags = currentTags.filter(t => t !== cleanSlug);
        const newCol = (prod.collection === cleanSlug) ? (filteredTags[0] || '') : prod.collection;
        batch.update(doc(db, 'products', pId), {
          collectionTags: filteredTags,
          collection: newCol
        });
        prod.collectionTags = filteredTags;
        prod.collection = newCol;
        hasOps = true;
      }
    }
  });

  if (hasOps) {
    try {
      await batch.commit();
      store.notifySubscribers(currentProducts);
    } catch (e) {
      console.error("[updateProductsCollectionTags Error]:", e);
    }
  }
}

export async function getOrders() {
  if (store.orders && store.orders.length > 0) return store.orders;
  try {
    const snapshot = await getDocs(collection(db, 'orders'));
    const list = [];
    snapshot.forEach(d => list.push({ orderNumber: d.id, ...d.data() }));
    list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    store.orders = list;
    return list;
  } catch (e) {
    return [];
  }
}

export function generateDailyOrderNumber(dateObj = new Date()) {
  const d = String(dateObj.getDate()).padStart(2, '0');
  const m = String(dateObj.getMonth() + 1).padStart(2, '0');
  const y = dateObj.getFullYear();
  const rand = Math.floor(100 + Math.random() * 900);
  return `${d}-${m}-${y}-${rand}`;
}

export const generateNextOrderNumber = generateDailyOrderNumber;

export async function createOrder(orderData) {
  const orderNumber = orderData.orderNumber || generateDailyOrderNumber();
  const orderRecord = {
    ...orderData,
    orderNumber,
    createdAt: Date.now(),
    status: orderData.status || 'PAID'
  };

  try {
    await setDoc(doc(db, 'orders', orderNumber), sanitizeForFirestore(orderRecord));
  } catch (e) {
    console.warn("[createOrder] Error guardando pedido en Firestore:", e);
  }

  if (Array.isArray(orderRecord.items)) {
    await updateProductStockAfterOrder(orderRecord.items);
  }

  const list = [orderRecord, ...store.orders];
  store.orders = list;
  localStorage.setItem(STORAGE_ORDERS_KEY, JSON.stringify(list));
  store.ordersSubscribers.forEach(cb => cb(list));

  return orderRecord;
}

export async function updateOrderStatus(orderNumber, updates = {}) {
  try {
    await updateDoc(doc(db, 'orders', orderNumber), sanitizeForFirestore(updates));
  } catch (e) {
    console.warn("[updateOrderStatus] Error en Firestore:", e);
  }

  const list = store.orders.map(o => o.orderNumber === orderNumber ? { ...o, ...updates } : o);
  store.orders = list;
  localStorage.setItem(STORAGE_ORDERS_KEY, JSON.stringify(list));
  store.ordersSubscribers.forEach(cb => cb(list));
  return true;
}

/**
 * SINCRONIZACIÓN REAL DE UN PEDIDO CON PACKLINK PRO (POST /v1/shipments)
 */
export async function syncOrderWithPacklink(orderNumber, overrides = {}) {
  let order = (store.orders || []).find(o => o.orderNumber === orderNumber);
  if (!order) {
    try {
      const snap = await getDoc(doc(db, 'orders', orderNumber));
      if (snap.exists()) {
        order = { orderNumber: snap.id, ...snap.data() };
      }
    } catch (e) {
      console.warn("[syncOrderWithPacklink] Error recuperando pedido de Firestore:", e);
    }
  }

  if (!order) {
    return { ok: false, error: `Pedido #${orderNumber} no encontrado en la base de datos.` };
  }

  // Llamada oficial a Packlink PRO API
  const res = await createPacklinkShipment(order, store.settings, overrides);

  if (res.ok && res.reference) {
    const packlinkData = {
      synced: true,
      reference: res.reference,
      syncedAt: Date.now(),
      serviceId: res.serviceId || overrides.service_id || order.packlink?.serviceId || null,
      carrierName: res.carrierName || overrides.carrierName || order.packlink?.carrierName || "Correos Express",
      serviceName: res.serviceName || overrides.serviceName || order.packlink?.serviceName || "Paq 24",
      dashboardUrl: `https://pro.packlink.es/private/shipments/${res.reference}`,
      lastPayload: res.payload
    };

    const orderUpdates = {
      packlink: packlinkData
    };
    if (res.carrierName) {
      orderUpdates['shipping.carrier'] = res.carrierName;
      orderUpdates['shipping.serviceName'] = res.serviceName || packlinkData.serviceName;
      if (res.serviceId) orderUpdates['shipping.serviceId'] = res.serviceId;
    }

    try {
      await updateDoc(doc(db, 'orders', orderNumber), sanitizeForFirestore(orderUpdates));
    } catch (e) {
      console.warn("[syncOrderWithPacklink] Error actualizando doc de pedido en Firestore:", e);
    }

    const updatedList = (store.orders || []).map(o => o.orderNumber === orderNumber ? {
      ...o,
      packlink: packlinkData,
      shipping: {
        ...(o.shipping || {}),
        carrier: res.carrierName || o.shipping?.carrier,
        serviceName: res.serviceName || o.shipping?.serviceName,
        serviceId: res.serviceId || o.shipping?.serviceId
      }
    } : o);
    store.orders = updatedList;
    localStorage.setItem(STORAGE_ORDERS_KEY, JSON.stringify(updatedList));
    store.ordersSubscribers.forEach(cb => {
      try { cb(updatedList); } catch (e) {}
    });

    return {
      ok: true,
      reference: res.reference,
      orderNumber,
      channel: res.channel,
      dashboardUrl: packlinkData.dashboardUrl,
      data: res.data
    };
  }

  // En caso de error
  const errMsg = res.error || 'Error al conectar con la API oficial de Packlink PRO';
  try {
    await updateDoc(doc(db, 'orders', orderNumber), sanitizeForFirestore({
      'packlink.synced': false,
      'packlink.lastError': errMsg,
      'packlink.lastAttemptAt': Date.now()
    }));
  } catch (e) {}

  return {
    ok: false,
    error: errMsg,
    details: res.details
  };
}

export async function syncAllToFirestore(opts = {}) {
  const batch = writeBatch(db);
  const catalog = DEFAULT_CATALOG.map(normalizeProductSchema);

  catalog.forEach((prod, index) => {
    prod.order = index;
    const refDoc = doc(db, 'products', prod.id);
    batch.set(refDoc, sanitizeForFirestore(prod));
  });

  const settingsRef = doc(db, 'settings', 'store_config');
  batch.set(settingsRef, sanitizeForFirestore(MOCK_SETTINGS));

  await batch.commit();
  store.products = catalog;
  store.settings = { ...MOCK_SETTINGS };
  localStorage.setItem(STORAGE_PRODUCTS_KEY, JSON.stringify(catalog));
  localStorage.setItem(STORAGE_SETTINGS_KEY, JSON.stringify(store.settings));
  store.notifySubscribers(catalog);
  return true;
}

export async function resetDatabaseToFactory() {
  return syncAllToFirestore({ forceOverwrite: true });
}
