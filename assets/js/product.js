/**
 * PRODUCT PAGE CONTROLLER - RONEO SHOP (FASE 5.1 DEFINITIVA)
 * Control dinámico de ficha de producto con matriz de stock por color y talla.
 * Sincronización en tiempo real (< 100ms) mediante onSnapshot (subscribeToProductById).
 * Zero Emojis · 100% Iconos SVG.
 */

import {
  getProductByIdOrSlug,
  getProducts,
  getRelatedProducts,
  getStoreSettings,
  subscribeToProductById,
  subscribeToSettings
} from './store-service.js';
import {
  addToCart
} from './cart.js';
import {
  formatPrice,
  renderProductCardMarkup,
  bindProductCardEvents,
  setupCommonUI,
  renderCartDrawer,
  updateCartBadges,
  openCartDrawer,
  setupAnnouncement,
  applySettingsToDOM
} from './ui.js';

// Estado de la ficha de producto
let currentProduct = null;
let selectedSize = null;
let selectedColor = null;
let currentQuantity = 1;
let currentPhotoIndex = 0;
let productImages = [];
let unsubscribeProduct = null;
let unsubscribeSettings = null;

document.addEventListener('DOMContentLoaded', async () => {
  try {
    const params = new URLSearchParams(window.location.search);
    const productId = params.get('id');

    // 1. Carga inicial del producto
    let product = await getProductByIdOrSlug(productId);
    if (!product) {
      const all = await getProducts();
      product = all.find(p => p.id === 'abrigo-pandora') || all[0];
    }

    if (!product) {
      console.error("[ProductPage] No se encontró ningún producto disponible.");
      return;
    }

    currentProduct = product;
    initProductPage(product);

    // Componentes de interfaz comunes
    setupCommonUI();
    renderCartDrawer();
    updateCartBadges();

    // 2. Suscripción en vivo al documento del producto con onSnapshot (< 100ms)
    unsubscribeProduct = subscribeToProductById(product.id, (updatedProd) => {
      if (updatedProd) {
        currentProduct = updatedProd;
        // Preservar color y talla seleccionados si aún existen
        const prevColorName = selectedColor?.name;
        const prevSize = selectedSize;

        initProductPage(updatedProd, prevColorName, prevSize);
      }
    });

    // 3. Suscripción en vivo a los ajustes
    unsubscribeSettings = subscribeToSettings((settings) => {
      applySettingsToDOM(settings);
    });

  } catch (err) {
    console.error("[ProductPage] Error al inicializar ficha de producto:", err);
  }
});

window.addEventListener('beforeunload', () => {
  if (typeof unsubscribeProduct === 'function') unsubscribeProduct();
  if (typeof unsubscribeSettings === 'function') unsubscribeSettings();
});

/**
 * Inicializa y renderiza los elementos de la ficha de producto
 */
function initProductPage(product, preserveColorName = null, preserveSize = null) {
  productImages = (Array.isArray(product.images) && product.images.length > 0)
    ? product.images
    : ['assets/img/placeholder.webp'];

  if (currentPhotoIndex >= productImages.length) {
    currentPhotoIndex = 0;
  }

  // 1. Determinar color seleccionado
  const colors = Array.isArray(product.colors) ? product.colors : [];
  if (colors.length > 0) {
    if (preserveColorName) {
      selectedColor = colors.find(c => c.name.toLowerCase() === preserveColorName.toLowerCase()) || colors[0];
    } else {
      // Preferir primer color con unidades disponibles
      const inStockColor = colors.find(c => (c.sizes || []).some(s => s.stock > 0));
      selectedColor = inStockColor || colors[0];
    }
  } else {
    selectedColor = null;
  }

  // 2. Determinar talla seleccionada para el color actual
  const colorSizes = selectedColor?.sizes || product.variants || [];
  if (product.hasSizes !== false && colorSizes.length > 0) {
    if (preserveSize && colorSizes.some(s => s.size === preserveSize && s.stock > 0)) {
      selectedSize = preserveSize;
    } else {
      const inStockSize = colorSizes.find(s => s.stock > 0);
      selectedSize = inStockSize ? inStockSize.size : colorSizes[0].size;
    }
  } else {
    selectedSize = 'ÚNICA';
  }

  renderBreadcrumbs(product);
  renderGallery();
  renderDetails(product);
  renderColors(product);
  renderSizes(product);
  updateStockAndBuyState();
  setupQuantityStepper();
  setupActionButtons();
  setupLightbox();
  setupUtilityLinks(product);
  loadRelatedProducts(product);
}

/**
 * Renderiza migas de pan
 */
function renderBreadcrumbs(product) {
  const catEl = document.getElementById('breadcrumb-category');
  const titleEl = document.getElementById('breadcrumb-title');
  const pageTitle = document.getElementById('page-title');

  const categoryName = (product.subCategory || product.category || 'ropa').toLowerCase();
  if (catEl) {
    catEl.textContent = categoryName;
    catEl.href = `collection.html?cat=${encodeURIComponent(product.category || 'ropa')}`;
  }
  if (titleEl) {
    titleEl.textContent = product.title;
  }
  if (pageTitle) {
    pageTitle.textContent = `${product.title} | Roneo Shop`;
  }
}

/**
 * Renderiza la imagen principal de la galería
 */
function renderGallery() {
  const mainImg = document.getElementById('pdp-main-image');
  const counterEl = document.getElementById('pdp-pager-counter');
  const prevBtn = document.getElementById('pdp-pager-prev');
  const nextBtn = document.getElementById('pdp-pager-next');

  if (!mainImg) return;

  const currentSrc = productImages[currentPhotoIndex] || productImages[0];
  mainImg.src = currentSrc;
  mainImg.alt = `${currentProduct.title} - Foto ${currentPhotoIndex + 1}`;

  if (counterEl) {
    counterEl.textContent = `${currentPhotoIndex + 1} / ${productImages.length}`;
  }

  if (prevBtn) {
    prevBtn.disabled = (currentPhotoIndex === 0);
  }
  if (nextBtn) {
    nextBtn.disabled = (currentPhotoIndex === productImages.length - 1);
  }
}

function setupLightbox() {
  const prevBtn = document.getElementById('pdp-pager-prev');
  const nextBtn = document.getElementById('pdp-pager-next');
  const zoomTrigger = document.getElementById('pdp-zoom-trigger');
  const lightbox = document.getElementById('pdp-lightbox');
  const lightboxImg = document.getElementById('pdp-lightbox-img');
  const lightboxClose = document.getElementById('pdp-lightbox-close');

  if (prevBtn) {
    prevBtn.onclick = () => {
      if (currentPhotoIndex > 0) {
        currentPhotoIndex--;
        renderGallery();
      }
    };
  }

  if (nextBtn) {
    nextBtn.onclick = () => {
      if (currentPhotoIndex < productImages.length - 1) {
        currentPhotoIndex++;
        renderGallery();
      }
    };
  }

  if (zoomTrigger && lightbox && lightboxImg) {
    zoomTrigger.onclick = () => {
      lightboxImg.src = productImages[currentPhotoIndex] || productImages[0];
      lightbox.classList.add('is-open');
      document.body.style.overflow = 'hidden';
    };
  }

  if (lightboxClose && lightbox) {
    lightboxClose.onclick = () => {
      lightbox.classList.remove('is-open');
      document.body.style.overflow = '';
    };
  }

  if (lightbox) {
    lightbox.onclick = (e) => {
      if (e.target === lightbox) {
        lightbox.classList.remove('is-open');
        document.body.style.overflow = '';
      }
    };
  }
}

function renderDetails(product) {
  const titleEl = document.getElementById('pdp-product-title');
  const priceEl = document.getElementById('pdp-product-price');
  const comparePriceEl = document.getElementById('pdp-compare-price');
  const descEl = document.getElementById('accordion-desc');

  if (titleEl) titleEl.textContent = product.title;
  if (priceEl) priceEl.textContent = formatPrice(product.price);

  if (comparePriceEl) {
    if (product.compareAtPrice && product.compareAtPrice > product.price) {
      comparePriceEl.textContent = formatPrice(product.compareAtPrice);
      comparePriceEl.style.display = 'inline';
    } else {
      comparePriceEl.style.display = 'none';
    }
  }

  if (descEl) {
    const descDetails = descEl.closest('.accordion-item');
    if (product.description && product.description.trim().length > 0) {
      descEl.innerHTML = `<p>${escapeHtml(product.description)}</p>`;
      if (descDetails) descDetails.style.display = 'block';
    } else {
      descEl.innerHTML = '';
      if (descDetails) descDetails.style.display = 'none';
    }
  }
}

/**
 * Renderiza el selector de colores circulares
 */
function renderColors(product) {
  const colorsSection = document.getElementById('pdp-colors-section');
  const container = document.getElementById('pdp-colors-container');
  const colorNameLabel = document.getElementById('pdp-selected-color-name');

  if (!colorsSection || !container) return;

  const colors = Array.isArray(product.colors) ? product.colors : [];

  if (colors.length === 0 || (colors.length === 1 && colors[0].name.toLowerCase() === 'color único')) {
    colorsSection.style.display = 'none';
    return;
  }

  colorsSection.style.display = 'block';
  if (colorNameLabel && selectedColor) {
    colorNameLabel.textContent = selectedColor.name;
  }

  container.innerHTML = colors.map(color => {
    const isSelected = selectedColor && selectedColor.name === color.name;
    const totalColorUnits = (color.sizes || []).reduce((acc, s) => acc + (s.stock || 0), 0);
    const isOutOfStock = totalColorUnits <= 0;
    const selectedClass = isSelected ? 'is-selected' : '';
    const outClass = isOutOfStock ? 'is-out' : '';

    return `
      <button 
        type="button" 
        class="color-swatch-circle ${selectedClass} ${outClass}" 
        data-color-name="${escapeHtml(color.name)}" 
        style="background-color: ${color.hex};" 
        title="${escapeHtml(color.name)}${isOutOfStock ? ' (Agotado)' : ` (${totalColorUnits} uds)`}" 
        aria-label="Color ${escapeHtml(color.name)}"
      ></button>
    `;
  }).join('');

  container.querySelectorAll('.color-swatch-circle').forEach(btn => {
    btn.onclick = () => {
      const colorName = btn.dataset.colorName;
      const found = colors.find(c => c.name === colorName);
      if (!found) return;

      selectedColor = found;
      if (colorNameLabel) colorNameLabel.textContent = found.name;

      container.querySelectorAll('.color-swatch-circle').forEach(b => b.classList.remove('is-selected'));
      btn.classList.add('is-selected');

      // Si el color tiene una foto asignada, mover suavemente la galería hacia esa foto
      if (typeof found.imageIndex === 'number' && productImages[found.imageIndex]) {
        currentPhotoIndex = found.imageIndex;
        renderGallery();
      }

      // Al cambiar de color, recalcular las tallas y comprobar disponibilidad en ese color
      const colorSizes = found.sizes || [];
      if (currentProduct.hasSizes !== false && colorSizes.length > 0) {
        const currentSizeObj = colorSizes.find(s => s.size === selectedSize);
        if (!currentSizeObj || currentSizeObj.stock <= 0) {
          const firstAvailable = colorSizes.find(s => s.stock > 0);
          selectedSize = firstAvailable ? firstAvailable.size : colorSizes[0].size;
        }
      }

      renderSizes(currentProduct);
      updateStockAndBuyState();
    };
  });
}

/**
 * Renderiza el selector circular de tallas adaptado al color seleccionado
 */
function renderSizes(product) {
  const sizesSection = document.getElementById('pdp-sizes-section');
  const container = document.getElementById('pdp-sizes-container');
  const sizeNameLabel = document.getElementById('pdp-selected-size-name');

  if (!sizesSection || !container) return;

  if (product.hasSizes === false) {
    sizesSection.style.display = 'none';
    selectedSize = 'ÚNICA';
    return;
  }

  sizesSection.style.display = 'block';
  if (sizeNameLabel) {
    sizeNameLabel.textContent = selectedSize || '--';
  }

  // Tallas específicas del color actualmente activo
  const activeSizes = selectedColor?.sizes || product.variants || [];

  container.innerHTML = activeSizes.map(v => {
    const isSelected = v.size === selectedSize;
    const isOut = (v.stock <= 0);
    const selectedClass = isSelected ? 'is-selected' : '';
    const outClass = isOut ? 'is-out' : '';

    return `
      <button 
        type="button" 
        class="size-circle-btn ${selectedClass} ${outClass}" 
        data-size="${escapeHtml(v.size)}" 
        title="Talla ${escapeHtml(v.size)}${isOut ? ' (Agotada en este color)' : ` (${v.stock} disponibles)`}" 
        aria-label="Talla ${escapeHtml(v.size)}"
      >
        ${escapeHtml(v.size)}
      </button>
    `;
  }).join('');

  container.querySelectorAll('.size-circle-btn').forEach(btn => {
    btn.onclick = () => {
      const sizeVal = btn.dataset.size;
      selectedSize = sizeVal;
      if (sizeNameLabel) sizeNameLabel.textContent = sizeVal;

      container.querySelectorAll('.size-circle-btn').forEach(b => b.classList.remove('is-selected'));
      btn.classList.add('is-selected');

      updateStockAndBuyState();
    };
  });
}

/**
 * Obtiene el stock disponible para la combinación exacta de color y talla seleccionados
 */
function getSelectedStock() {
  if (!currentProduct) return 0;

  // Si la prenda no tiene tallas, leer el stock del color seleccionado
  if (currentProduct.hasSizes === false) {
    if (selectedColor && Array.isArray(selectedColor.sizes) && selectedColor.sizes.length > 0) {
      return Number(selectedColor.sizes[0].stock) || 0;
    }
    return (currentProduct.variants && currentProduct.variants[0]) ? Number(currentProduct.variants[0].stock) : 0;
  }

  // Si tiene tallas, buscar en las tallas del color seleccionado
  if (selectedColor && Array.isArray(selectedColor.sizes)) {
    const sizeObj = selectedColor.sizes.find(s => s.size === selectedSize);
    if (sizeObj) return Number(sizeObj.stock) || 0;
  }

  // Fallback en variants agregadas
  const variant = (currentProduct.variants || []).find(v => v.size === selectedSize);
  return variant ? (Number(variant.stock) || 0) : 0;
}

/**
 * Actualiza los indicadores visuales de stock, botón de carrito y botón de compra exprés
 */
function updateStockAndBuyState() {
  const stock = getSelectedStock();
  const isAvailable = stock > 0;

  const badgeSoldOut = document.getElementById('pdp-badge-soldout');
  const stockDot = document.getElementById('pdp-stock-dot');
  const stockLabel = document.getElementById('pdp-stock-label');
  const addCartBtn = document.getElementById('btn-pdp-add-cart');
  const expressBtn = document.getElementById('btn-pdp-express');

  if (isAvailable) {
    if (badgeSoldOut) badgeSoldOut.style.display = 'none';
    if (stockDot) {
      stockDot.className = 'pdp-stock-dot is-in';
    }
    if (stockLabel) {
      stockLabel.textContent = stock <= 3 ? `Solo quedan ${stock} unidades` : 'En stock, listo para enviar';
    }
    if (addCartBtn) {
      addCartBtn.disabled = false;
      addCartBtn.textContent = 'Añadir a la cesta';
    }
    if (expressBtn) {
      expressBtn.classList.remove('is-disabled');
      expressBtn.disabled = false;
    }
  } else {
    if (badgeSoldOut) badgeSoldOut.style.display = 'inline-block';
    if (stockDot) {
      stockDot.className = 'pdp-stock-dot is-out';
    }
    if (stockLabel) {
      stockLabel.textContent = 'Agotado en esta combinación';
    }
    if (addCartBtn) {
      addCartBtn.disabled = true;
      addCartBtn.textContent = 'Agotado';
    }
    if (expressBtn) {
      expressBtn.classList.add('is-disabled');
      expressBtn.disabled = true;
    }
  }

  if (isAvailable && currentQuantity > stock) {
    currentQuantity = stock;
    const qtyVal = document.getElementById('pdp-qty-val');
    if (qtyVal) qtyVal.textContent = currentQuantity;
  }
}

function setupQuantityStepper() {
  const minusBtn = document.getElementById('pdp-qty-minus');
  const plusBtn = document.getElementById('pdp-qty-plus');
  const qtyVal = document.getElementById('pdp-qty-val');

  if (minusBtn) {
    minusBtn.onclick = () => {
      if (currentQuantity > 1) {
        currentQuantity--;
        if (qtyVal) qtyVal.textContent = currentQuantity;
      }
    };
  }

  if (plusBtn) {
    plusBtn.onclick = () => {
      const stock = getSelectedStock();
      if (currentQuantity < stock) {
        currentQuantity++;
        if (qtyVal) qtyVal.textContent = currentQuantity;
      }
    };
  }
}

function setupActionButtons() {
  const addCartBtn = document.getElementById('btn-pdp-add-cart');
  const expressBtn = document.getElementById('btn-pdp-express');

  if (addCartBtn) {
    addCartBtn.onclick = () => {
      if (!currentProduct) return;
      const stock = getSelectedStock();
      if (stock <= 0) return;

      const sizeToAdd = (currentProduct.hasSizes === false) ? 'ÚNICA' : selectedSize;
      const colorToAdd = selectedColor ? selectedColor.name : 'Color Único';
      const colorHexToAdd = selectedColor ? selectedColor.hex : '#121212';

      addToCart(currentProduct, sizeToAdd, currentQuantity, colorToAdd, colorHexToAdd);
      updateCartBadges();
      renderCartDrawer();
      openCartDrawer();
    };
  }

  if (expressBtn) {
    expressBtn.onclick = () => {
      if (!currentProduct) return;
      const stock = getSelectedStock();
      if (stock <= 0) return;

      const sizeToAdd = (currentProduct.hasSizes === false) ? 'ÚNICA' : selectedSize;
      const colorToAdd = selectedColor ? selectedColor.name : 'Color Único';
      const colorHexToAdd = selectedColor ? selectedColor.hex : '#121212';

      addToCart(currentProduct, sizeToAdd, currentQuantity, colorToAdd, colorHexToAdd);
      updateCartBadges();
      window.location.href = 'checkout.html';
    };
  }
}

function setupUtilityLinks(product) {
  const shareBtn = document.getElementById('pdp-share-btn');
  if (shareBtn) {
    shareBtn.onclick = async () => {
      const shareData = {
        title: `${product.title} | Roneo Shop`,
        text: `Descubre esta prenda en Roneo Shop: ${product.title} - ${formatPrice(product.price)}`,
        url: window.location.href
      };

      if (navigator.share) {
        try {
          await navigator.share(shareData);
        } catch (err) {}
      } else {
        try {
          await navigator.clipboard.writeText(window.location.href);
          const originalText = shareBtn.querySelector('span').textContent;
          shareBtn.querySelector('span').textContent = 'Enlace copiado al portapapeles';
          setTimeout(() => {
            shareBtn.querySelector('span').textContent = originalText;
          }, 2200);
        } catch (clipErr) {
          console.error("Error al copiar enlace:", clipErr);
        }
      }
    };
  }
}

async function loadRelatedProducts(product) {
  const track = document.getElementById('related-track');
  if (!track) return;

  try {
    const related = await getRelatedProducts(product.id, product.category, 4);
    if (!related || related.length === 0) {
      const section = track.closest('.related-products-section');
      if (section) section.style.display = 'none';
      return;
    }

    track.innerHTML = related.map(item => renderProductCardMarkup(item)).join('');
    bindProductCardEvents(track, related);
  } catch (err) {
    console.error("[ProductPage] Error al cargar productos relacionados:", err);
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
