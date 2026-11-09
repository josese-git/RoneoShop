# ARQUITECTURA Y CONTRATO DE DATOS (ARCHITECTURE.md)

Este documento es la ÚNICA fuente de verdad para la estructura de archivos, el flujo de datos en tiempo real (Firebase Plan Blaze a Coste 0,00 €) y los esquemas JSON de Firestore, Storage, LocalStorage e IndexedDB de **Roneo Shop** (`roneoshop-es`).

---

## 1. ESTRUCTURA OFICIAL DEL REPOSITORIO
```text
/
├── AGENTS.md                     # Directivas operativas y reglas de Coste 0,00 € en Plan Blaze
├── ARCHITECTURE.md               # Contrato técnico de datos, esquemas y rutas
├── DESIGN_SYSTEM.md              # Sistema de diseño visual, paleta blanca/choco y animaciones
├── firebase.json                 # Configuración de Firebase Hosting, Functions, Firestore y Storage
├── .firebaserc                   # Vinculación oficial al proyecto "roneoshop-es"
├── firestore.rules               # Reglas de seguridad de Cloud Firestore
├── storage.rules                 # Reglas de seguridad de Firebase Storage
├── cors.json                     # Configuración CORS del bucket roneoshop-es.firebasestorage.app
├── index.html                    # Portada inmersiva (Hero full-bleed + Merge Intro + Nueva Colección + Secciones + Novedades)
├── collection.html               # Catálogo completo con contador de prendas y píldoras dinámicas de filtro
├── product.html                  # Ficha detallada 1:1 (Galería, selector por color y talla, envío y relacionados)
├── checkout.html                 # Resumen superior desplegable + Autocompletado CP Peninsular + Selector Correos/Correos Express
├── admin/
│   ├── index.html                # Panel de administración (Prendas y Stock, Pedidos y Packlink, Ajustes Tienda + Modal Cropper)
│   ├── admin.css                 # Hoja de estilos del panel de administración
│   └── admin.js                  # Lógica CRUD reactiva, modo Ordenar (writeBatch), Cropper.js, Categorías, Colecciones y Packlink
├── assets/
│   ├── img/
│   │   ├── logo-roneo.png        # Logotipo oficial RONEO SHOP (#4d2525)
│   │   └── favicon-roneo.png     # Favicon oficial monograma RS (#4d2525)
│   ├── css/
│   │   ├── tokens.css            # Variables CSS oficiales (Blanco #ffffff, Choco #4d2525, Dorado #dfc298, Tipografías)
│   │   ├── base.css              # Reset, layout responsive, comportamiento de Header y Scroll
│   │   └── components.css        # Hero Lux, Launch Section, Tarjetas 4:5, Badges, Drawers, Carrito y Animaciones
│   └── js/
│       ├── firebase-config.js    # SDK modular Firebase v10.13.0 (Auth, Firestore ignoreUndefinedProperties, Storage)
│       ├── store-service.js      # Singleton Store con onSnapshot, Fingerprint Diffing, IndexedDB y CRUD Firestore/Storage
│       ├── packlink-service.js   # Cliente oficial Packlink PRO API v1 (Tarifas Correos + IVA, redondeo ,99€ y envíos completos)
│       ├── cart.js               # Gestión reactiva del carrito por producto + color + talla (localStorage)
│       ├── ui.js                 # Navegación global, Drawers, animaciones (Merge Intro, Curtain, Words) y tarjetas de producto
│       ├── collection.js         # Controlador reactivo de collection.html
│       ├── product.js            # Controlador reactivo de product.html (matriz de stock por color y relacionados)
│       └── checkout.js           # Controlador de checkout.html (validación peninsular, tarifas en vivo y creación de pedido)
└── functions/
    └── index.js                  # Proxy Serverless opcional para llamadas a la API de Packlink PRO (/api/packlink/*)
```

---

## 2. ESQUEMA DE COLECCIONES EN CLOUD FIRESTORE (`roneoshop-es`)

### A) Colección: `products` (ID documento: `slug` limpio, ej. `"abrigo-pandora"`)
```json
{
  "id": "abrigo-pandora",
  "slug": "abrigo-pandora",
  "title": "Abrigo Pandora Camel",
  "description": "Abrigo midi estructurado en tejido suave con corte estilizado.",
  "category": "ropa",
  "subCategory": "otono-invierno",
  "collectionTags": ["otono-invierno", "novedades"],
  "price": 49.95,
  "compareAtPrice": 69.95,
  "weightKg": 0.65,
  "order": 0,
  "active": true,
  "featured": true,
  "hasSizes": true,
  "totalStock": 11,
  "images": [
    "https://firebasestorage.googleapis.com/v0/b/roneoshop-es.firebasestorage.app/o/products%2Fabrigo-pandora%2F1.webp?alt=media",
    "https://firebasestorage.googleapis.com/v0/b/roneoshop-es.firebasestorage.app/o/products%2Fabrigo-pandora%2F2.webp?alt=media"
  ],
  "imagesPreviewBase64": [],
  "colors": [
    {
      "name": "Camel",
      "hex": "#c19a6b",
      "imageIndex": 0,
      "totalStock": 5,
      "inStock": true,
      "sizes": [
        { "size": "S", "stock": 3 },
        { "size": "M", "stock": 2 },
        { "size": "L", "stock": 0 }
      ]
    },
    {
      "name": "Gris",
      "hex": "#808080",
      "imageIndex": 1,
      "totalStock": 6,
      "inStock": true,
      "sizes": [
        { "size": "S", "stock": 0 },
        { "size": "M", "stock": 4 },
        { "size": "L", "stock": 2 }
      ]
    }
  ],
  "variants": [
    { "size": "S", "stock": 3 },
    { "size": "M", "stock": 6 },
    { "size": "L", "stock": 2 }
  ],
  "createdAt": 1730715000000,
  "updatedAt": 1730715000000
}
```
*Reglas de ordenación y stock en `products`:*
- **Al editar una prenda existente:** Conserva estrictamente su campo numérico `order` y su `createdAt` para no moverla de su posición actual.
- **Al publicar una prenda nueva:** Se le asigna automáticamente `order = minOrder - 1` y `createdAt = Date.now()` para que aparezca en la **posición nº 1 (arriba del todo)** de su categoría y de Novedades.
- **Stock independiente por color:** Cada objeto dentro de `colors` mantiene su propio array `sizes`. `variants` y `totalStock` se recalculan automáticamente como la suma global de todos los colores.

---

### B) Colección: `orders` (ID documento: Fecha + Secuencia diaria `DD-MM-YYYY-NNN`, ej. `"09-11-2026-001"`)
```json
{
  "orderNumber": "09-11-2026-001",
  "redsysOrderCode": "091120260001",
  "status": "PAGADO",
  "paymentMethod": "CARD",
  "subtotal": 49.95,
  "shippingCost": 0.00,
  "total": 49.95,
  "totalWeightKg": 0.65,
  "customer": {
    "firstName": "Carmen",
    "lastName": "Ruiz Navarro",
    "email": "carmen@email.com",
    "phone": "655889900",
    "street": "Calle Córdoba 13",
    "apartment": "1D",
    "fullStreet": "Calle Córdoba 13, 1D",
    "zipCode": "29730",
    "city": "Rincón de la Victoria",
    "province": "Málaga",
    "country": "ES",
    "zone": "ESPAÑA PENÍNSULA"
  },
  "shipping": {
    "carrier": "Correos",
    "serviceName": "Correos · Paq Estándar Domicilio (48/72h)",
    "serviceId": 20339,
    "costWithVat": 0.00
  },
  "items": [
    {
      "cartItemId": "abrigo-pandora_Camel_S",
      "productId": "abrigo-pandora",
      "title": "Abrigo Pandora Camel",
      "color": "Camel",
      "colorHex": "#c19a6b",
      "size": "S",
      "price": 49.95,
      "quantity": 1,
      "image": "https://firebasestorage.googleapis.com/.../1.webp"
    }
  ],
  "packlink": {
    "synced": true,
    "reference": "ES2026PRO...",
    "serviceId": 20339,
    "carrierName": "Correos",
    "serviceName": "Correos Paq Estándar",
    "dashboardUrl": "https://pro.packlink.es/private/shipments/ES2026PRO...",
    "syncedAt": 1762680000000
  },
  "createdAt": 1762680000000
}
```

---

### C) Documento Único de Configuración: `settings/store_config`
```json
{
  "storeName": "Roneo Shop",
  "announcementText": "NUEVA COLECCIÓN OTOÑO & INVIERNO · ENVÍO A ESPAÑA PENÍNSULA 24/48H",
  "heroTitle": "Roneo Shop",
  "heroSubtitle": "Moda & Estilo",
  "heroImage": "https://firebasestorage.googleapis.com/...",
  "shippingStandardPrice": 4.99,
  "freeShippingThreshold": 50.00,
  "contactPhone": "622063691",
  "contactEmail": "1roneoshop@gmail.com",
  "instagramUrl": "https://instagram.com/",
  "tiktokUrl": "https://tiktok.com/",
  "packlinkApiKey": "f6343535d64a6f27e3dfa60297abc964a5d9f1d0f546d091c8485722ddbc25a5",
  "packlinkAutoSync": true,
  "packlinkParcel": {
    "length": 30,
    "width": 25,
    "height": 10,
    "defaultWeight": 0.5
  },
  "senderAddress": {
    "name": "Nerea",
    "surname": "Cortes Muñoz",
    "fullName": "Nerea Cortes Muñoz",
    "company": "Roneo Shop",
    "street": "Calle Norte 70",
    "street1": "Calle Norte 70",
    "zipCode": "23650",
    "zip_code": "23650",
    "city": "Torredonjimeno",
    "province": "Jaén",
    "state": "Jaén",
    "country": "ES",
    "countryLabel": "ESPAÑA PENÍNSULA",
    "phone": "622063691",
    "phoneFormatted": "+34 622 06 36 91",
    "email": "1roneoshop@gmail.com"
  },
  "categories": [
    { "id": "ropa", "name": "Ropa", "slug": "ropa", "order": 0, "isPlaceholder": false },
    { "id": "calzado", "name": "Calzado", "slug": "calzado", "order": 1, "isPlaceholder": false },
    { "id": "mas-proximamente", "name": "Más próximamente...", "slug": "mas-proximamente", "order": 2, "isPlaceholder": true }
  ],
  "collections": [
    {
      "id": "otono-invierno",
      "title": "Otoño & Invierno",
      "subtitle": "Colección de temporada",
      "slug": "otono-invierno",
      "image": "https://...",
      "order": 0,
      "active": true
    }
  ],
  "updatedAt": 1762680000000
}
```

---

## 3. ESTRUCTURA DEL CARRITO EN `localStorage` (Clave: `store_cart_v1`)
Identificador compuesto por `productId + "_" + color + "_" + size`:
```json
[
  {
    "cartItemId": "abrigo-pandora_Camel_S",
    "productId": "abrigo-pandora",
    "title": "Abrigo Pandora Camel",
    "color": "Camel",
    "colorHex": "#c19a6b",
    "size": "S",
    "price": 49.95,
    "compareAtPrice": 69.95,
    "image": "https://firebasestorage.googleapis.com/.../1.webp",
    "quantity": 1,
    "maxStock": 3
  }
]
```
