# SISTEMA DE DISEÑO: CLON EXACTO YOANA ZAFIRO (DESIGN_SYSTEM.md)

Este documento define la especificación visual y de interacción **100% Mobile-First** basada en la interfaz real de `yoanazafiro.com`.

## 1. PRINCIPIOS DE DISEÑO Y "REDONDISMO"
* **Bordes Redondeados Universales:**
  - Imágenes de producto (`.product-card__media`): `border-radius: 12px;`.
  - Badges de estado (`.product-card__badge`): `border-radius: 6px;`.
  - Botón flotante de compra (`.product-card__bag-btn`): circular `border-radius: 50%;`.
  - Botones primarios (`.btn-primary`): `border-radius: 10px;`.
  - Píldoras de talla (`.size-pill`): `border-radius: 8px;`.
  - Modales inferiores (*Bottom Sheets*): `border-radius: 20px 20px 0 0;` en móvil.
* **Proporciones y Alturas Estilizadas:**
  - 1 sola foto vertical por prenda (sin cambio de imagen en hover).
  - En carrusel móvil, efecto escalonado auténtico: tarjeta impar `aspect-ratio: 3 / 4;`, tarjeta par `aspect-ratio: 9 / 14;` (para estilizar abrigos y vaqueros).
* **Tipografías:**
  - Pestañas de categorías y logo de marca: `'Cormorant Garamond'`, serif elegante, mayúsculas, tamaño 24px-28px.
  - Textos, interfaz, títulos de producto y precios: `'DM Sans'`, sans-serif contemporánea.
* **Formato de Precio Oficial:**
  - Símbolo del euro PEGADO DELANTE y coma decimal: **`€24,95`** (estilo Yoana Zafiro).

---

## 2. COMPONENTES CLAVE DE LA INTERFAZ MÓVIL

### A) Header y Announcement Bar
* **Announcement Bar:** Franja negra (`#121212`) con texto en mayúsculas (`11px`, `letter-spacing: 0.06em`), ajuste de texto flexible sin desbordamiento horizontal (`word-wrap: break-word`).
* **Header Fijo (62px):** Distribución simétrica en 3 zonas (menú hamburguesa a la izquierda, logo `ZAFIRO` en serif al centro, lupa de búsqueda y bolsa de compra con badge numérico circular a la derecha).

### B) Buscador Desplegable (`.search-bar-drawer`)
* Se despliega con animación fluida bajo el header al pulsar la lupa o la pestaña *Buscar* de la barra inferior.
* Campo de búsqueda con esquinas redondeadas (`8px`), fondo gris suave (`#f3f3f3`) y filtrado en vivo por texto.

### C) Pestañas de Categorías Serif (`.category-tabs`)
* Contenedor horizontal sin barra de scroll visible.
* Pestañas en mayúsculas con fuente Serif (`Cormorant Garamond`): `ROPA`, `NOVEDADES`, `VESTIDOS`, `ABRIGOS`, `VAQUEROS`, `REBAJAS`.
* Estado inactivo: gris tenue (`#b8b8b8`); estado activo: negro rotundo (`#121212`).

### D) Carrusel Horizontal "Peek" en Móvil
* En móvil muestra 2 tarjetas completas de ancho `43.5%` cada una y asoma un `~13%` de la tercera tarjeta por el lateral derecho (`grid-auto-columns: 43.5%;`).
* Desplazamiento táctil suave con `scroll-snap-type: x mandatory;`.
* Botón centrado inferior `VER TODO` que conmuta la visualización a cuadrícula vertical de 2 columnas (`.products-track--grid`).

### E) Tarjeta de Producto (`.product-card`)
* **Badge Superior Izquierdo (`top: 10px; left: 10px`):**
  - Si no hay stock: `"Agotado"` con fondo gris translúcido (`rgba(155, 155, 155, 0.88)`), texto blanco en negrita (`11px`) y filtro blur.
  - Si hay stock y descuento: badge negro `"-XX%"`.
* **Botón Circular Flotante (`bottom: 10px; right: 10px`):**
  - Botón blanco circular de 38x38px con sombra `0 2px 8px rgba(0,0,0,0.16)`.
  - Icono SVG de bolso de compra en negro.
  - Presente incluso en prendas agotadas (abre el modal mostrando tallas sin stock).
* **Detalles Inferiores:**
  - Título en mayúsculas sobrias (`12px`, peso 400).
  - Precio en negrita (`13.5px`, peso 700) con formato `€XX,XX` y precio anterior tachado si aplica.

### F) Barra Inferior Fija de 5 Botones (`.bottom-tab-bar`)
* Barra fija de 60px de alto en la parte inferior de pantallas móviles (`< 990px`).
* 5 accesos directos:
  1. **Home:** Scroll suave a la cabecera y modo carrusel.
  2. **Buscar:** Despliega y enfoca el buscador rápido.
  3. **Carro:** Desliza el Cart Drawer con badge de unidades.
  4. **Productos:** Cambia al modo cuadrícula completa de 2 columnas.
  5. **Info:** Abre el modal inferior con información de envíos Packlink 24/48h, devoluciones y Bizum.

### G) Modales Inferiores (Bottom Sheets)
* Despliegue desde la parte inferior con curva `cubic-bezier(0.22, 1, 0.36, 1)` y esquinas superiores redondeadas (`20px 20px 0 0`).

