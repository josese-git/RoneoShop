# ARQUITECTURA Y CONTRATO DE DATOS (ARCHITECTURE.md)

Este documento es la ÚNICA fuente de verdad para la estructura de carpetas y los esquemas JSON de Firestore y LocalStorage.

## 1. ESTRUCTURA DEL REPOSITORIO
```text
/
├── AGENTS.md                  # Reglas del agente IA
├── ARCHITECTURE.md            # Este contrato técnico
├── DESIGN_SYSTEM.md           # Tokens visuales (Inspirado en Shopify Dawn · Roneo Shop)
├── index.html                 # Home (Hero + Colección destacada + Cart Drawer + QuickAdd Modal)
├── collection.html            # Catálogo completo con filtros por categoría, talla y precio
├── product.html               # Vista individual de prenda con galería y guía de tallas
├── checkout.html              # Formulario de envío + Selector Tarjeta / Bizum (conecta al Worker)
├── admin/
│   ├── index.html             # Panel privado (Pestañas: Prendas, Pedidos, Ajustes)
│   ├── admin.css              # Estilos limpios del panel de gestión (Mobile-first)
│   └── admin.js               # Lógica CRUD Firestore + Compresor WebP + Link a Packlink
├── assets/
│   ├── css/
│   │   ├── tokens.css         # Variables CSS oficiales de Roneo Shop
│   │   ├── base.css           # Reset, tipografía, grid system y utilidades Dawn
│   │   └── components.css     # Header, Product Card, Cart Drawer, Modales y Badges
│   └── js/
│       ├── firebase-config.js # Inicialización de Firebase App, Auth, Firestore y Storage
│       ├── store-service.js   # Lectura de productos/settings con caché en sessionStorage
│       ├── cart.js            # Máquina de estados del carrito (localStorage + eventos UI)
│       └── ui.js              # Renderizado de tarjetas, modal "Elige opciones" y Cart Drawer
└── worker-redsys/
    └── index.js               # Cloudflare Worker (Firma Redsys/Bizum + Webhook + Packlink PRO API)
```

## 2. ESQUEMA DE COLECCIONES EN FIRESTORE

### A) Colección: `products` (ID documento: autogenerado o slug)
```json
{
  "id": "vestido-roneo-negro",
  "title": "Vestido Roneo Negro",
  "slug": "vestido-roneo-negro",
  "description": "Vestido midi confeccionado en tejido fluido...",
  "category": "vestidos",
  "price": 29.95,
  "compareAtPrice": 39.95,
  "weightKg": 0.35,
  "active": true,
  "featured": true,
  "hasSizes": true,
  "images": [
    "https://firebasestorage.googleapis.com/.../foto1.webp",
    "https://firebasestorage.googleapis.com/.../foto2-hover.webp"
  ],
  "colors": [
    {
      "name": "Beige",
      "hex": "#e8dfc8",
      "imageIndex": 0,
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
      "sizes": [
        { "size": "S", "stock": 0 },
        { "size": "M", "stock": 4 },
        { "size": "L", "stock": 2 }
      ]
    }
  ],
  "variants": [
    { "size": "S", "stock": 3, "sku": "VZ-NEG-S" },
    { "size": "M", "stock": 6, "sku": "VZ-NEG-M" },
    { "size": "L", "stock": 2, "sku": "VZ-NEG-L" }
  ],
  "createdAt": 1730715000000
}
```
*Reglas de negocio en UI:*
- Si `compareAtPrice > price`, mostrar badge de rebaja con el porcentaje calculado `-XX%` y el precio anterior tachado.
- Si la suma de `stock` de todas las `variants` es `0`, mostrar badge `"Agotado"` y deshabilitar compra.
- Si `images[1]` existe, al hacer `:hover` en la tarjeta del producto se muestra `images[1]` con transición suave.

### B) Colección: `orders` (ID documento: Nº de pedido de Redsys de 12 dígitos, ej. `"261104102530"`)
```json
{
  "orderNumber": "261104102530",
  "status": "PAID", 
  "paymentMethod": "BIZUM",
  "subtotal": 29.95,
  "shippingCost": 4.90,
  "total": 34.85,
  "totalWeightKg": 0.35,
  "customer": {
    "firstName": "Laura",
    "lastName": "Gómez",
    "email": "laura@email.com",
    "phone": "600112233",
    "street": "Calle Larios 12, 3ºB",
    "city": "Málaga",
    "province": "Málaga",
    "zipCode": "29005",
    "country": "ES"
  },
  "items": [
    {
      "productId": "vestido-roneo-negro",
      "title": "Vestido Roneo Negro",
      "size": "M",
      "price": 29.95,
      "quantity": 1,
      "image": "https://.../foto1.webp"
    }
  ],
  "packlink": {
    "synced": true,
    "reference": "ES2026PRO998877",
    "trackingUrl": ""
  },
  "createdAt": 1730715600000,
  "paidAt": 1730715645000
}
```
*Nota:* `status` solo puede ser `"PENDING"`, `"PAID"` o `"CANCELLED"`.

### C) Documento único de configuración: `settings/store_config`
```json
{
  "storeName": "NOMBRE DE MARCA",
  "announcementText": "ENVÍOS GRATIS EN PEDIDOS SUPERIORES A 60€ ✨",
  "heroBannerDesktop": "https://.../banner-pc.webp",
  "heroBannerMobile": "https://.../banner-movil.webp",
  "heroTitle": "NUEVA COLECCIÓN",
  "shippingStandardPrice": 4.90,
  "freeShippingThreshold": 60.00,
  "categories": ["novedades", "vestidos", "conjuntos", "partes-de-arriba", "pantalones", "rebajas"]
}
```

## 3. ESTRUCTURA DEL CARRITO EN `localStorage` (Clave: `store_cart_v1`)
Array de objetos con clave única combinada `id + "_" + color + "_" + size`:
```json
[
  {
    "cartItemId": "abrigo-pandora_gris_M",
    "productId": "abrigo-pandora",
    "title": "ABRIGO PANDORA",
    "size": "M",
    "color": "Gris",
    "colorHex": "#808080",
    "price": 38.00,
    "compareAtPrice": 45.00,
    "image": "https://.../foto1.webp",
    "quantity": 1,
    "maxStock": 4
  }
]
```