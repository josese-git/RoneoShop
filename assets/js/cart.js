/**
 * CART STATE MACHINE - MÁQUINA DE ESTADOS DEL CARRITO
 * Gestiona el carrito en localStorage bajo la clave 'store_cart_v1'
 * siguiendo fielmente ARCHITECTURE.md Sección 3.
 */

export const CART_STORAGE_KEY = 'store_cart_v1';

/**
 * Obtiene los artículos del carrito desde localStorage
 * @returns {Array} Array de objetos de carrito
 */
export function getCart() {
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error("[Cart] Error al leer carrito de localStorage:", e);
    return [];
  }
}

/**
 * Guarda los artículos en localStorage y opcionalmente dispara evento
 * @param {Array} items
 * @param {boolean} openDrawer
 */
function saveCart(items, openDrawer = false) {
  try {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  } catch (e) {
    console.error("[Cart] Error al guardar carrito en localStorage:", e);
  }

  window.dispatchEvent(
    new CustomEvent('cart:updated', {
      detail: { openDrawer, cart: items }
    })
  );
}

/**
 * Añade un producto y talla al carrito respetando el stock máximo
 * @param {Object} product Objeto de producto completo según ARCHITECTURE.md
 * @param {string} size Talla seleccionada (ej. "M")
 * @param {number} quantity Cantidad a añadir (por defecto 1)
 * @returns {boolean} True si se añadió exitosamente
 */
export function addToCart(product, size, quantity = 1) {
  if (!product || !size || quantity <= 0) return false;

  const variant = product.variants ? product.variants.find(v => v.size === size) : null;
  const maxStock = variant ? variant.stock : 0;

  if (maxStock <= 0) {
    console.warn(`[Cart] Talla ${size} sin stock disponible`);
    return false;
  }

  const cart = getCart();
  const cartItemId = `${product.id}_${size}`;
  const existingIndex = cart.findIndex(item => item.cartItemId === cartItemId);

  const mainImage = (product.images && product.images.length > 0)
    ? product.images[0]
    : '';

  if (existingIndex > -1) {
    const currentQty = cart[existingIndex].quantity;
    const allowedAdd = Math.min(quantity, maxStock - currentQty);
    if (allowedAdd <= 0) {
      // Ya se alcanzó el stock máximo en cesta
      saveCart(cart, true);
      return false;
    }
    cart[existingIndex].quantity = currentQty + allowedAdd;
    cart[existingIndex].maxStock = maxStock; // Actualizar stock más reciente
  } else {
    const finalQty = Math.min(quantity, maxStock);
    const newItem = {
      cartItemId,
      productId: product.id,
      title: product.title,
      size,
      price: product.price,
      compareAtPrice: product.compareAtPrice || null,
      image: mainImage,
      quantity: finalQty,
      maxStock
    };
    cart.push(newItem);
  }

  saveCart(cart, true);
  return true;
}

/**
 * Actualiza la cantidad de un ítem existente
 * @param {string} cartItemId Identificador compuesto id_talla
 * @param {number} newQuantity Nueva cantidad deseada
 */
export function updateCartItemQuantity(cartItemId, newQuantity) {
  const cart = getCart();
  const index = cart.findIndex(item => item.cartItemId === cartItemId);
  if (index === -1) return;

  if (newQuantity <= 0) {
    cart.splice(index, 1);
  } else {
    const item = cart[index];
    const capped = Math.min(newQuantity, item.maxStock);
    item.quantity = capped;
  }

  saveCart(cart, false);
}

/**
 * Elimina por completo un artículo del carrito
 * @param {string} cartItemId Identificador compuesto id_talla
 */
export function removeFromCart(cartItemId) {
  const cart = getCart();
  const filtered = cart.filter(item => item.cartItemId !== cartItemId);
  saveCart(filtered, false);
}

/**
 * Vacía el carrito por completo
 */
export function clearCart() {
  saveCart([], false);
}

/**
 * Calcula todos los totales, gastos de envío y barra de envío gratis
 * @param {number} freeShippingThreshold Umbral para envío gratis (60.00 € por defecto)
 * @param {number} shippingStandardPrice Coste de envío estándar (4.90 € por defecto)
 */
export function getCartTotals(freeShippingThreshold = 60.00, shippingStandardPrice = 4.90) {
  const cart = getCart();

  let totalItems = 0;
  let subtotal = 0;

  for (const item of cart) {
    totalItems += item.quantity;
    subtotal += item.price * item.quantity;
  }

  // Redondear a dos decimales para evitar artefactos de coma flotante
  subtotal = Math.round(subtotal * 100) / 100;

  const hasFreeShipping = subtotal >= freeShippingThreshold;
  const shippingCost = (totalItems === 0 || hasFreeShipping) ? 0 : shippingStandardPrice;
  const total = Math.round((subtotal + shippingCost) * 100) / 100;

  const remainingForFreeShipping = hasFreeShipping
    ? 0
    : Math.max(0, Math.round((freeShippingThreshold - subtotal) * 100) / 100);

  const freeShippingProgressPercent = Math.min(
    100,
    Math.round((subtotal / freeShippingThreshold) * 100)
  );

  return {
    totalItems,
    subtotal,
    shippingCost,
    total,
    remainingForFreeShipping,
    freeShippingProgressPercent,
    hasFreeShipping
  };
}

