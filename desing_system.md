# SISTEMA DE DISEÑO: CLON YOANA ZAFIRO / SHOPIFY DAWN (DESIGN_SYSTEM.md)

Toda la interfaz pública debe replicar con precisión milimétrica la estética minimalista del tema Dawn de Shopify usado en `yoanazafiro.com`.

## 1. REGLAS VISUALES CLAVE
* **Estética General:** Fondo blanco puro (`#FFFFFF`), textos en negro profundo con ligera transparencia para textos secundarios (`rgba(18, 18, 18, 0.75)`), bordes finos de `1px solid rgba(18, 18, 18, 0.12)` y esquinas rectas (`border-radius: 0px` en botones e inputs).
* **Proporción de Fotos (Product Card):** TODAS las imágenes de producto usan estrictamente `aspect-ratio: 3 / 4` (vertical moda) con `object-fit: cover` y fondo gris neutro suave (`#F5F5F5`) mientras cargan.
* **Efecto Hover en Tarjetas:**
  - En escritorio (`@media (hover: hover)`), al pasar el ratón sobre `.product-card`:
    1. La imagen principal (`img.primary`) pasa a `opacity: 0` y aparece la segunda imagen (`img.secondary`) con un ligero zoom (`transform: scale(1.03)` con transición de `0.4s ease`).
    2. El título del producto se subraya suavemente (`text-decoration: underline; text-underline-offset: 3px`).
* **Badges (Etiquetas sobre la foto):**
  - Posicionados en la esquina inferior izquierda de la foto (`bottom: 10px; left: 10px`).
  - Formato cápsula o rectangular limpio, tipografía `11px`, `letter-spacing: 0.08em`.
  - `"Agotado"`: Fondo blanco o gris oscuro, texto sobrio.
  - `"-XX%"` (Rebaja): Fondo acento o negro, texto blanco.
* **Botón "Elige opciones" (Quick Add):**
  - Debajo del precio en cada tarjeta de producto.
  - Ancho 100% (`width: 100%`), fondo transparente, borde `1px solid #121212`, texto `13px` centrado, `padding: 10px 16px`. Al hacer hover, el borde sube a grosor `2px` (efecto clásico de Shopify Dawn `box-shadow: 0 0 0 1px #121212`).
* **Cart Drawer (Carrito Deslizable) y Modal "Elige Opciones":**
  - Fondo oscuro traslúcido (`backdrop`: `rgba(18, 18, 18, 0.5)`) con transición de opacidad.
  - El carrito sale desde la derecha (`width: 400px`, `max-width: 92vw`) con animación `cubic-bezier(0.25, 1, 0.5, 1)`.
  - Incluye barra de progreso de envío gratis en la parte superior del carrito (*"Te faltan X,XX € para tener envío GRATIS"*).