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
* **Display / Títulos Editoriales (`--font-serif`):** `'Fraunces'`, `'Cormorant Garamond'`, Georgia, serif. Usada en el Hero (`Roneo SHOP`), `#nueva-coleccion` (`Tu esencia,`), títulos de sección (`Compra por sección`, `Novedades`, `Catálogo`) y encabezados.
* **Caligráfica / Script (`--font-script`):** `'Great Vibes'`, cursive.
* **Interfaz, Precios y Navegación (`--font-sans`):** `'Jost'`, `'DM Sans'`, sans-serif. Con `font-variant-numeric: tabular-nums` en todos los precios.
* **Formato de Precios:** Número con coma decimal seguido de espacio y símbolo de euro: **`32,95 €`** (y precio anterior tachado a su derecha `39,95 €`).

---

## 3. ARQUITECTURA DE LA PORTADA (`index.html` — `body.home-page`)
1. **Vista Inicial Inmersiva (`scrollY === 0`):**
   - Al entrar en `index.html`, no se muestra ni `.announcement-bar` ni `.site-header` en la parte superior.
   - El `.hero-lux` ocupa el `100vw` sin márgenes ni bordes redondeados (`height: calc(100dvh - 68px)` en móvil, `100dvh` en escritorio), mostrando la fotografía de portada completa, el nombre `Roneo SHOP` enmarcado exclusivamente por dos ornamentos vectoriales finos (cresta superior y pez cristiano Ichthys inferior en dorado `#dfc298`), el chevron flotante `∨` y la barra fija inferior de 5 botones. Cero frases secundarias en la foto.
2. **Fundido Continuo ("Seamless Melt") hacia `#nueva-coleccion`:**
   - `.hero-lux__veil` aplica un degradado progresivo que culmina en `#180f0f` al `100%`, fundiéndose sin costuras (`margin-top: -2px`) con la sección oscura `#nueva-coleccion`.
3. **Sección `#nueva-coleccion` (Propuesta Editorial):**
   - Fondo `#180f0f`, sin cinta interior.
   - Línea 1: `Tu esencia,` en serif itálica dorada cálida (`#dfc298`).
   - Línea 2: **`TU ESTILO`** en mayúsculas negritas blancas (`#ffffff`).
   - Línea 3: `RONEO SHOP · EXCLUSIVE SELECTION` con espaciado amplio en tono dorado (`#dfc298`).
   - Subtítulo TikTok: "Toda nuestra ropa aparece en vídeo en nuestro TikTok oficial **@roneoshop**".
   - Botones dobles: `EXPLORAR CATÁLOGO` (dorado sólido `#dfc298`) y `VER ROPA EN TIKTOK` (borde dorado con icono TikTok).
   - Nota de condiciones: `ENVÍO 24/48H ESPAÑA PENÍNSULA · GRATIS DESDE 80€ · REGALO EN PEDIDOS +150€`.
4. **Control Inteligente de Banner y Header con Scroll:**
   - `.announcement-bar` está anclada arriba del todo (`top: 0; height: 32px;`).
   - En `index.html`: permanece oculta con `scrollY <= 50`. Al hacer scroll (`scrollY > 50`) y mientras la sección `#novedades-section` sea visible, se muestran juntas la barra de anuncios (`top: 0`) y la navbar (`top: 32px`) con clase `.show-top-banner`. Al scrollear por debajo de `#novedades-section`, la barra de anuncios se oculta hacia arriba y la navbar transiciona suavemente a `top: 0`.
   - En páginas interiores (`collection.html`, `product.html`, `checkout.html`): `.announcement-bar` fija en `top: 0` y `.site-header` fija en `top: 32px`, con `padding-top: calc(32px + 60px) = 92px` en el `body`.

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
    1. **`Inicio`** (Casa SVG) -> `index.html`
    2. **`Catálogo`** (Percha de moda SVG) -> `collection.html?cat=todos`
    3. **`Info`** (Pin de ubicación SVG) -> Abre `#about-modal` / `#info-modal`
    4. **`Carrito`** (Bolsa con badge dinámico) -> Abre `#cart-drawer`
    5. **`Cuenta`** (Usuario SVG) -> Abre `#account-preview-modal`

---

## 5. COREOGRAFÍA DE ANIMACIONES (60FPS)
1. **Intro Merge en Portada (`body.intro-stage-1`):** Cortina `#140c0c` (`z-index: 3`) bajo `.hero-lux__brand` (`z-index: 4`). Las letras `Roneo SHOP` nacen en el centro de la pantalla y a los `720ms`, mientras la cortina se disuelve revelando la foto de la clienta, las mismas letras descienden suavemente hasta posarse en la parte inferior de la fotografía.
2. **Cortina de Imagen (`[data-fx="curtain"]`):** Revelado vertical suave de las fotografías de producto al entrar en el viewport.
3. **Palabras Escalonadas (`[data-fx="words"]`):** Aparición palabra por palabra en los titulares principales sin reiniciarse en actualizaciones posteriores.

---

## 6. PIE DE PÁGINA SIMÉTRICO (`.site-footer`)
* **Móvil (3x4 Simétrico Paralelo):**
  - Cabecera de marca superior centrada con línea divisoria inferior.
  - Rejilla paralela de 3 columnas iguales (`repeat(3, 1fr)`) para `TIENDA`, `AYUDA` y `LEGAL`.
  - Títulos de columna centrados y 4 enlaces centrados por columna (exactamente 4 líneas por columna).
* **Escritorio:** Rejilla fluida de 4 columnas (`1.4fr 1fr 1fr 1fr`).

