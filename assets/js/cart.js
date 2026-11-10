/**
 * CART STATE MACHINE - MÁQUINA DE ESTADOS DEL CARRITO
 * Gestiona el carrito en localStorage bajo la clave 'store_cart_v1'
 * con soporte para matriz independiente de Color y Talla (cartItemId compuesto).
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
 * Guarda los artículos en localStorage y dispara evento reactivo
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
 * Añade un producto con talla y color específicos al carrito respetando el stock disponible
 * @param {Object} product Objeto de producto normalizado
 * @param {string} size Talla seleccionada (ej. "M")
 * @param {number} quantity Cantidad a añadir
 * @param {string|null} color Nombre del color (ej. "Gris")
 * @param {string|null} colorHex Código hexadecimal del color (ej. "#808080")
 * @returns {boolean} True si se añadió exitosamente
 */
export function addToCart(product, size, quantity = 1, color = null, colorHex = null) {
  if (!product || !size || quantity <= 0) return false;

  const cleanSize = String(size || 'ÚNICA').toUpperCase().trim();
  const resolvedColorName = color || (product.colors?.[0]?.name || 'Color Único');
  const resolvedColorHex = colorHex || (product.colors?.[0]?.hex || '#121212');
  const cleanColorSlug = resolvedColorName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

  // Identificador compuesto id_color_talla
  const cartItemId = `${product.id}_${cleanColorSlug}_${cleanSize}`;

  // Calcular el stock máximo para esta combinación exacta de color y talla
  let maxStock = 0;
  if (Array.isArray(product.colors) && product.colors.length > 0) {
    const colorObj = product.colors.find(c => (c.name || '').toLowerCase() === resolvedColorName.toLowerCase()) || product.colors[0];
    if (colorObj && Array.isArray(colorObj.sizes)) {
      const sizeObj = colorObj.sizes.find(s => s.size === cleanSize);
      maxStock = sizeObj ? (Number(sizeObj.stock) || 0) : 0;
    }
  }

  // Fallback si no encontró en colorObj: revisar variants agregadas
  if (maxStock <= 0 && Array.isArray(product.variants)) {
    const variant = product.variants.find(v => v.size === cleanSize);
    if (variant) maxStock = Number(variant.stock) || 0;
  }

  if (maxStock <= 0) {
    console.warn(`[Cart] Combinación ${product.title} en color "${resolvedColorName}" y talla "${cleanSize}" sin stock disponible`);
    return false;
  }

  const cart = getCart();
  const existingIndex = cart.findIndex(item => item.cartItemId === cartItemId);

  // Seleccionar la foto adecuada para el color si tiene imageIndex
  let mainImage = (product.images && product.images.length > 0) ? product.images[0] : '';
  if (Array.isArray(product.colors)) {
    const matchingColor = product.colors.find(c => (c.name || '').toLowerCase() === resolvedColorName.toLowerCase());
    if (matchingColor && typeof matchingColor.imageIndex === 'number' && product.images?.[matchingColor.imageIndex]) {
      mainImage = product.images[matchingColor.imageIndex];
    }
  }

  if (existingIndex > -1) {
    const currentQty = cart[existingIndex].quantity;
    const allowedAdd = Math.min(quantity, maxStock - currentQty);
    if (allowedAdd <= 0) {
      saveCart(cart, true);
      return false;
    }
    cart[existingIndex].quantity = currentQty + allowedAdd;
    cart[existingIndex].maxStock = maxStock;
  } else {
    const finalQty = Math.min(quantity, maxStock);
    const newItem = {
      cartItemId,
      productId: product.id,
      title: product.title,
      size: cleanSize,
      color: resolvedColorName,
      colorHex: resolvedColorHex,
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
 * @param {string} cartItemId Identificador compuesto id_color_talla
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
 * @param {string} cartItemId Identificador compuesto id_color_talla
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
 * Calcula todos los totales, gastos de envío, barra de envío gratis (+80€) y regalo exclusivo (+150€)
 * @param {number} freeShippingThreshold Umbral para envío gratis (€80.00 por defecto en Fase 8.2)
 * @param {number} shippingStandardPrice Coste de envío estándar (€4.99 por defecto, redondeado a ,99€)
 * @param {number} freeGiftThreshold Umbral para regalo exclusivo (€150.00 por defecto)
 */
export function getCartTotals(freeShippingThreshold = 80.00, shippingStandardPrice = 4.99, freeGiftThreshold = 150.00) {
  const cart = getCart();

  let totalItems = 0;
  let subtotal = 0;

  for (const item of cart) {
    const qty = parseInt(item.quantity, 10) || 1;
    totalItems += qty;
    subtotal += Number(item.price) * qty;
  }

  subtotal = Math.round(subtotal * 100) / 100;

  const hasFreeShipping = subtotal >= freeShippingThreshold && subtotal > 0;
  
  // Regla matemática: si el envío no es gratis, se redondea a ,99€
  let roundedShipping = 0;
  if (totalItems > 0 && !hasFreeShipping) {
    const cleanPrice = Number(parseFloat(shippingStandardPrice).toFixed(2));
    if (!isNaN(cleanPrice) && cleanPrice > 0) {
      const integerBracket = Math.max(0, Math.ceil(cleanPrice) - 1);
      roundedShipping = Number((integerBracket + 0.99).toFixed(2));
    } else {
      roundedShipping = 4.99;
    }
  }

  const shippingCost = (totalItems === 0 || hasFreeShipping) ? 0 : roundedShipping;
  const total = Math.round((subtotal + shippingCost) * 100) / 100;

  const remainingForFreeShipping = hasFreeShipping
    ? 0
    : Math.max(0, Math.round((freeShippingThreshold - subtotal) * 100) / 100);

  const freeShippingProgressPercent = Math.min(
    100,
    Math.round((subtotal / freeShippingThreshold) * 100)
  );

  const hasFreeGift = subtotal >= freeGiftThreshold && subtotal > 0;
  const remainingForFreeGift = hasFreeGift
    ? 0
    : Math.max(0, Math.round((freeGiftThreshold - subtotal) * 100) / 100);

  const freeGiftProgressPercent = Math.min(
    100,
    Math.round((subtotal / freeGiftThreshold) * 100)
  );

  return {
    totalItems,
    totalUnits: totalItems,
    subtotal,
    shippingCost,
    total,
    remainingForFreeShipping,
    freeShippingProgressPercent,
    hasFreeShipping,
    freeGiftThreshold,
    hasFreeGift,
    remainingForFreeGift,
    freeGiftProgressPercent
  };
}
