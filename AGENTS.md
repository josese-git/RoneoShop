# DIRECTIVAS ESTRICTAS DEL AGENTE (AGENTS.md)

Actúas como Principal Full-Stack E-commerce Architect para **Roneo Shop** (`roneoshop-es`).
El proyecto opera sobre **Firebase Plan Blaze (Pay-as-you-go)** con el **objetivo inquebrantable de Coste Mensual 0,00 €**, manteniéndose siempre por debajo de los umbrales gratuitos incluidos en Blaze (50.000 lecturas/día, 20.000 escrituras/día, 20.000 borrados/día en Firestore; 5 GB de almacenamiento y 1 GB/día de transferencia en Storage; 2 millones de invocaciones/mes en Cloud Functions).

---

## 1. PROTOCOLO "PIENSA ANTES DE CODIFICAR" (OBLIGATORIO)
Antes de generar o modificar cualquier archivo, escribe siempre un bloque `[PLAN DE EJECUCIÓN]` de máximo 5 líneas indicando:
1. Qué archivos exactos vas a crear o modificar.
2. Qué esquemas o propiedades de `ARCHITECTURE.md` están involucrados.
3. Cómo se garantiza el **Coste 0,00 € en Plan Blaze** (deduplicación por huella, caché local e inmutabilidad de assets).

---

## 2. REGLAS TÉCNICAS Y DE ARQUITECTURA INQUEBRANTABLES

### A) Stack Puro, Modular y Sin Frameworks Pesados
* **Frontend:** HTML5 semántico, CSS3 moderno (variables en `assets/css/tokens.css`, reset en `assets/css/base.css` y componentes en `assets/css/components.css`) y Vanilla JavaScript ES6 Modules (`type="module"`).
* **Prohibiciones:** Prohibido instalar frameworks pesados por NPM en el frontend (React, Vue, Angular, Bootstrap, jQuery) y **terminantemente prohibido usar emojis Unicode** en archivos `.html`, `.css`, `.js` o `.md`. Todos los iconos deben ser vectores `<svg>` (`stroke="currentColor" stroke-width="1.75" fill="none"`).
* **Protección de CSS Compartido:** Nunca borres clases CSS existentes en `assets/css/components.css` que den soporte a `product.html`, `collection.html`, `checkout.html` o a los drawers globales (`#cart-drawer`, `#mobile-menu-drawer`, `#search-drawer`, `#store-info-modal`, `#account-preview-modal`).

### B) Ingeniería de Coste 0,00 € en Firebase Plan Blaze
1. **Patrón Singleton Observer (`class Store` en `assets/js/store-service.js`):**
   - Se abre **un único canal WebSocket `onSnapshot`** por pestaña hacia las colecciones `products`, `settings/store_config` y `orders`.
   - **Prohibido** hacer llamadas `getDocs()` redundantes dentro de bucles de renderizado o al cambiar de filtro en el catálogo.
2. **Hidratación Síncrona Instantánea (0ms) + Deduplicación por Huella (`Fingerprint Diffing`):**
   - Al arrancar cualquier página, `Store` hidrata inmediatamente la memoria desde `localStorage` (`store_db_products_v10`, `store_db_settings_v10`, `roneo_hero_image_v1`) evitando cualquier parpadeo visual (*flicker*).
   - Cuando `onSnapshot` emite desde Firestore, se calcula la huella (`computeProductsFingerprint` / `computeSettingsFingerprint`). Si la huella es idéntica a la ya renderizada en el DOM (`container.dataset.renderedHash === hash`), **se bloquea el re-renderizado destructivo** para no reiniciar las animaciones ni consumir CPU.
3. **Optimización Extrema de Firebase Storage y `Cropper.js`:**
   - Toda imagen subida desde `/admin` (prendas, colecciones o portada) se recorta con `Cropper.js` (`checkCrossOrigin: false`, `checkOrientation: false`) y se comprime en cliente mediante `<canvas>` a formato **`.webp`** (`maxWidth: 1080px`, `maxHeight: 1440px`, calidad `0.84`, peso objetivo `45 KB – 90 KB`).
   - Las imágenes se suben con `uploadBytes()` a rutas deterministas limpias (`products/{productId}/{index + 1}.webp` y `collections/{slug}.webp`) con cabecera `cacheControl: 'public,max-age=31536000'`.
   - Al editar una prenda en `/admin`, las imágenes que ya empiezan por `https://firebasestorage.googleapis.com/` **no se vuelven a subir** (deduplicación estricta).
   - La caché local `IndexedDB` (`roneoshop_media_cache_v1`) y `imagesPreviewBase64` permiten abrir `Cropper.js` en 0ms sin gastar ancho de banda de Storage ni sufrir bloqueos CORS.

### C) Reglas de Negocio de Envíos y Logística (Packlink PRO + Correos)
1. **Invisibilidad de Packlink de cara al comprador:**
   - En las páginas públicas (`index.html`, `collection.html`, `product.html`, `checkout.html`) **jamás se menciona la palabra "Packlink"**. De cara al cliente, los envíos se realizan exclusivamente con **`Correos`** (Paq Estándar Domicilio 48/72h) y **`Correos Express`** (Entrega Urgente 24h) para **España Península**.
2. **Remitente Fijo e Inmutable (`FIXED_SENDER_ADDRESS`):**
   - Todos los envíos salen siempre desde: **Nerea Cortes Muñoz · Roneo Shop · Calle Norte 70 · 23650 Torredonjimeno (Jaén), ESPAÑA PENÍNSULA (`ES`) · Tel: `622063691` (`+34 622 06 36 91`) · Email: `1roneoshop@gmail.com`**.
3. **Redondeo Matemático Estricto de Envíos a `,99 €` (`roundShippingPriceTo99`):**
   - Todo precio de envío con IVA (21%) se redondea al tramo `,99 €` mediante `Math.max(0, Math.ceil(cleanPrice) - 1) + 0.99`:
     - Si el envío con IVA es `<= 4,00 €` (ej. `3,45 €` o `4,00 €`) -> **`3,99 €`**.
     - Si el envío con IVA supera `4,00 €` hasta `5,00 €` (ej. `4,59 €`) -> **`4,99 €`**.
     - Si supera `5,00 €` hasta `6,00 €` (ej. `5,64 €`) -> **`5,99 €`**.
     - Si el subtotal del carrito alcanza o supera `freeShippingThreshold` (`50,00 €`), el envío estándar es **`GRATIS (0,00 €)`**.
4. **Envíos 100% Completos ("Listo para pagar") en Packlink PRO:**
   - Todo `POST /v1/shipments` resuelve previamente la localidad y provincia oficiales del código postal en el catálogo de Packlink (`resolvePacklinkPostalLocation`), une la calle y el piso una única vez (`buildCleanSingleStreet` en `street1`, sin duplicar en `street2`) e inyecta siempre un `service_id` numérico válido de entrega a domicilio (`delivery_to_parcelshop: false`).
