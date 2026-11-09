# SISTEMA DE DISEÑO E INTERACCIÓN: RONEO SHOP (DESIGN_SYSTEM.md)

Este documento define las reglas visuales, paleta cromática, tipografía, layout y coreografía de animaciones a 60fps de **Roneo Shop**.

---

## 1. PALETA DE COLORES OFICIAL (`assets/css/tokens.css`)
La tienda emplea una estética limpia y luminosa sobre **Blanco Puro (`#ffffff`)** combinada con **Choco Espresso (`#4d2525` / `#180f0f`)** y **Dorado Suave (`#dfc298`)** (cero tonos rosas):
* `--color-bg`: `#ffffff` (Fondo principal de todas las páginas, drawers y modales).
* `--color-surface`: `#f8f7f5` (Superficies secundarias, cajas de garantía e inputs suaves).
* `--color-sand`: `#f3f1ed` (Fondo de carga de marcos fotográficos `4:5` y `3:4`).
* `--color-text`: `#231515` (Texto principal de máxima legibilidad).
* `--color-choco`: `#4d2525` (Color corporativo del logotipo Roneo Shop, botones primarios y badges de descuento).
* `--color-choco-deep`: `#180f0f` (Fondo de la sección `#nueva-coleccion`, cortina de intro y velo de fundido inferior del Hero).
* `--color-gold-soft`: `#dfc298` (Texto caligráfico `"Descubre la"`, cursiva *`colección`* y estrellas `.twinkle`).
* `--color-border`: `#e8e5e1` (Líneas divisorias sutiles).

---

## 2. TIPOGRAFÍAS OFICIALES
* **Display / Títulos Editoriales (`--font-serif`):** `'Fraunces'`, `'Cormorant Garamond'`, Georgia, serif. Usada en el Hero (`Roneo SHOP`), `#nueva-coleccion` (`NUEVA colección`), títulos de sección (`Compra por sección`, `Novedades`, `Catálogo`) y encabezados.
* **Caligráfica / Script (`--font-script`):** `'Great Vibes'`, cursive. Usada en el subtítulo del Hero (*`Moda & Estilo`*) y en el pre-título *`Descubre la`*.
* **Interfaz, Precios y Navegación (`--font-sans`):** `'Jost'`, `'DM Sans'`, sans-serif. Con `font-variant-numeric: tabular-nums` en todos los precios.
* **Formato de Precios:** Número con coma decimal seguido de espacio y símbolo de euro: **`32,95 €`** (y precio anterior tachado a su derecha `39,95 €`).

---

## 3. ARQUITECTURA DE LA PORTADA (`index.html` — `body.home-page`)
1. **Vista Inicial Inmersiva (`scrollY === 0`):**
   - Al entrar en `index.html`, no se muestra ni `.announcement-bar` ni `.site-header` en la parte superior.
   - El `.hero-lux` ocupa el `100vw` sin márgenes ni bordes redondeados (`height: calc(100dvh - 68px)` en móvil, `100dvh` en escritorio), mostrando la fotografía de portada completa, el texto superpuesto (`Roneo SHOP` / `— BOUTIQUE —` / *`Moda & Estilo`*), el chevron flotante `∨` y la barra fija inferior de 5 botones.
   - Al hacer scroll (`window.scrollY > 50`), `.site-header` aparece suavemente desde arriba (`body.home-page.is-scrolled .site-header`).
2. **Fundido Continuo ("Seamless Melt") hacia `#nueva-coleccion`:**
   - `.hero-lux__veil` aplica un degradado progresivo que culmina en `#180f0f` al `100%`, fundiéndose sin costuras (`margin-top: -2px`) con la sección oscura `#nueva-coleccion`.
3. **Sección `#nueva-coleccion` + Marquee Integrado:**
   - Fondo `#180f0f`, estrellas `<svg class="twinkle">`, `"Descubre la"` en fuente script dorada, **`NUEVA`** *`colección`*, `"OTOÑO · INVIERNO 2026"`, botones `COMPRAR AHORA` (blanco sólido) y `VER NOVEDADES` (borde blanco), nota de envío a España Península 24/48h y, en su base, la cinta `.launch-marquee` desplazándose en bucle continuo infinito.
4. **Comportamiento del Header y Banner en Páginas Interiores (`collection.html`, `product.html`, `checkout.html`):**
   - En las páginas interiores (`body:not(.home-page)`), `.announcement-bar` se sitúa arriba del todo en flujo normal (`position: relative`), de modo que al hacer scroll hacia abajo se oculta naturalmente y **solo la navbar (`.site-header`) acompaña al usuario pegada arriba (`position: sticky; top: 0;`)**.

---

## 4. TARJETAS DE PRODUCTO Y NAVEGACIÓN GLOBAL
* **Tarjetas de Producto (`.product-card`):**
  - Proporción uniforme `aspect-ratio: 4 / 5`, `border-radius: 12px`, sin asimetrías pares/impares.
  - **Badge compacto en esquina inferior izquierda (`bottom: 10px; left: 10px; top: auto !important; height: auto !important;`):**
    - `.product-card__badge--new`: Blanco marfil translúcido (`rgba(255,255,255,0.92)`) con texto `#231515` (`NUEVO`).
    - `.product-card__badge--discount`: Choco `#4d2525` con texto `#ffffff` (`-XX%`).
    - `.product-card__badge--soldout`: Oscuro `#180f0f` con texto `#ffffff` (`AGOTADO`).
  - Debajo de la foto: Título en `15px` con capitalización limpia (`Conjunto Punto Milán`), precio `32,95 €` y fila de tallas (`S M L` o `Única`, tachando con `<s>` las tallas agotadas).
* **Barra Fija Inferior Móvil (`height: 68px`) y Navegación Superior PC:**
  - 5 accesos con iconos `<svg>` de trazo fino:
    1. **`Inicio`** (Casa) -> `index.html`
    2. **`Catálogo`** (Diamante) -> `collection.html?cat=todos`
    3. **`Sobre mí`** (Corazón) -> Abre el modal editorial de información de Roneo Shop
    4. **`Carrito`** (Bolsa con contador numérico) -> Abre `#cart-drawer`
    5. **`Cuenta`** (Usuario) -> Abre `#account-preview-modal` (Área de clienta próximamente disponible + acceso rápido a seguimiento y admin)

---

## 5. COREOGRAFÍA DE ANIMACIONES (60FPS)
1. **Intro Merge en Portada (`body.intro-stage-1`):** Cortina `#140c0c` (`z-index: 3`) bajo `.hero-lux__brand` (`z-index: 4`). Las letras `Roneo SHOP` nacen en el centro de la pantalla y a los `720ms`, mientras la cortina se disuelve revelando la foto de la clienta, las mismas letras descienden suavemente hasta posarse en la parte inferior de la fotografía.
2. **Cortina de Imagen (`[data-fx="curtain"]`):** Revelado vertical suave de las fotografías de producto al entrar en el viewport.
3. **Palabras Escalonadas (`[data-fx="words"]`):** Aparición palabra por palabra en los titulares principales sin reiniciarse en actualizaciones posteriores.
