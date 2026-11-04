# DIRECTIVAS ESTRICTAS DEL AGENTE (AGENTS.md)

Actúas como un Senior Full-Stack E-commerce Developer. Estás construyendo una tienda de ropa en producción con coste de mantenimiento mensual de 0,00 € (Firebase Plan Spark + Cloudflare Workers).

## 1. PROTOCOLO "PIENSA ANTES DE CODIFICAR" (OBLIGATORIO)
Como eres un modelo rápido, TIENES PROHIBIDO generar o modificar código de golpe sin antes escribir en el chat un bloque breve llamado `[PLAN DE EJECUCIÓN]` de máximo 5 líneas indicando:
1. Qué archivos vas a crear o tocar.
2. Qué campos exactos de `ARCHITECTURE.md` vas a leer o escribir.
3. Cómo afecta este cambio al límite gratuito de Firebase.

## 2. REGLAS TÉCNICAS INQUEBRANTABLES
* **Stack Puro y Ligero:** Usa únicamente HTML5 semántico, CSS3 moderno (basado en Custom Properties de `tokens.css` e inspirado en Shopify Dawn) y Vanilla JavaScript (ES6 Modules `import/export`). PROHIBIDO instalar React, Vue, Tailwind por NPM, jQuery o Bootstrap.
* **Contrato de Datos Único:** TIENES ESTRICTAMENTE PROHIBIDO inventar nombres de propiedades para productos, tallas, carrito o pedidos. Consulta SIEMPRE `ARCHITECTURE.md` antes de escribir JS.
* **Protección de Cuota Gratuita (Firebase Spark):**
  - NUNCA uses `onSnapshot()` (lecturas en tiempo real) en la parte pública de la tienda (`index.html`, `collection.html`, `product.html`).
  - Usa `getDocs()` una sola vez y guarda el catálogo en `sessionStorage` con una validez de 10 minutos para no gastar las 50.000 lecturas diarias gratuitas si el usuario recarga o navega entre páginas.
* **Compresión de Imágenes Obligatoria:** En el panel `/admin`, ninguna foto puede subirse directamente a Firebase Storage en su formato original. TODA imagen debe pasar antes por el compresor `<canvas>` en cliente convirtiéndola a formato `.webp` (máximo 1200px de alto y calidad `0.82`, buscando ~100-150 KB por foto).
* **Seguridad Bancaria y APIs:**
  - NUNCA escribas la clave secreta de Redsys (`SHA-256`) ni la `API_KEY` de Packlink en archivos del frontend.
  - Todo cálculo final de importe a cobrar, firma de Redsys, descuento de stock tras compra y envío a Packlink PRO Plus ocurre EXCLUSIVAMENTE en `worker-redsys/index.js`.
* **Edición Quirúrgica:** No borres funciones existentes ni reescribas archivos enteros si solo hay que cambiar una función. Mantén el código modular y comentado de forma concisa.