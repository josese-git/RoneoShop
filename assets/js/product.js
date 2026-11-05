/**
 * PRODUCT PAGE CONTROLLER - YOANA ZAFIRO (FASE 3.5)
 * Clon exacto de ficha de producto estilo Yoana Zafiro (PDF Abrigo Pandora):
 * - Galería 3:4.2 con botón lupa circular y paginador minimalista < 1 / 2 >
 * - Lightbox modal de zoom
 * - Selector circular de color (con tachado si agotado)
 * - Botones circulares de tallas 44x44px (con tachado diagonal 45° si agotado)
 * - Soporte para hasSizes: false (oculta tallas y muestra stock global)
 * - Fila de acción unificada (stepper 112px + botón añadir a la cesta)
 * - Botón de compra exprés #5a31f4 ("Comprar ahora con Bizum / Tarjeta")
 * - Banner de envío gratis 50€ con icono SVG
 * - Enlaces útiles: Compartir (Web Share / Portapapeles) y Pregunta WhatsApp
 * - Sincronización en vivo multi-pestaña mediante BroadcastChannel('yoana_store_sync')
 */

import {
  getProductByIdOrSlug,
  getProducts,
  getRelatedProducts,
  getStoreSettings,
  onStoreDataChanged
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
  setupAnnouncement
} from './ui.js';

// Estado de la ficha de producto
let currentProduct = null;
let selectedSize = null;
let selectedColor = null;
let currentQuantity = 1;
let currentPhotoIndex = 0;
let productImages = [];

document.addEventListener('DOMContentLoaded', async () => {
  try {
    const settings = await getStoreSettings();
    setupAnnouncement(settings.announcementText || 'NUEVA COLECCIÓN 2026 OTOÑO & INVIERNO · ENVÍOS GRATIS A PARTIR DE 50€');

    // 1. Obtener ID o slug de los parámetros de la URL
    const params = new URLSearchParams(window.location.search);
    const productId = params.get('id');

    // 2. Cargar producto
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

    // Configurar componentes globales de interfaz
    setupCommonUI();
    renderCartDrawer();
    updateCartBadges();

    // 3. Escuchar sincronización en tiempo real desde el admin u otras pestañas
    setupLiveSync();

  } catch (err) {
    console.error("[ProductPage] Error al inicializar ficha de producto:", err);
  }
});

/**
 * Inicializa y renderiza todos los elementos de la ficha de producto
 */
function initProductPage(product) {
  productImages = (product.images && product.images.length > 0)
    ? product.images
    : ['assets/img/placeholder.webp'];
  
  currentPhotoIndex = 0;
  currentQuantity = 1;

  // Seleccionar color por defecto si tiene
  if (product.colors && product.colors.length > 0) {
    selectedColor = product.colors[0];
  } else {
    selectedColor = null;
  }

  // Seleccionar talla por defecto si tiene tallas
  if (product.hasSizes !== false && product.variants && product.variants.length > 0) {
    // Preferir primera talla con stock > 0
    const inStockVariant = product.variants.find(v => v.stock > 0);
    selectedSize = inStockVariant ? inStockVariant.size : product.variants[0].size;
  } else {
    selectedSize = (product.variants && product.variants[0]) ? product.variants[0].size : 'ÚNICA';
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
 * Renderiza las migas de pan centradas oficiales de Yoana Zafiro
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
    pageTitle.textContent = `${product.title} | Yoana Zafiro`;
  }
}

/**
 * Renderiza la imagen principal de la galería y actualiza el contador < 1 / 2 >
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

/**
 * Configura los botones de la galería táctil y de ampliación (Lightbox)
 */
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

  // Abrir Lightbox al pulsar botón de lupa
  if (zoomTrigger && lightbox && lightboxImg) {
    zoomTrigger.onclick = () => {
      lightboxImg.src = productImages[currentPhotoIndex] || productImages[0];
      lightbox.classList.add('is-open');
      document.body.style.overflow = 'hidden';
    };
  }

  // Cerrar Lightbox
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

/**
 * Renderiza título, precios y descripción
 */
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

  if (!product.colors || product.colors.length === 0) {
    colorsSection.style.display = 'none';
    return;
  }

  colorsSection.style.display = 'block';
  if (colorNameLabel && selectedColor) {
    colorNameLabel.textContent = selectedColor.name;
  }

  container.innerHTML = product.colors.map(color => {
    const isSelected = selectedColor && selectedColor.name === color.name;
    const isOutOfStock = color.inStock === false;
    const selectedClass = isSelected ? 'is-selected' : '';
    const outClass = isOutOfStock ? 'is-out' : '';

    return `
      <button 
        type="button" 
        class="color-swatch-circle ${selectedClass} ${outClass}" 
        data-color-name="${escapeHtml(color.name)}" 
        style="background-color: ${color.hex};" 
        title="${escapeHtml(color.name)}${isOutOfStock ? ' (Agotado)' : ''}" 
        aria-label="Color ${escapeHtml(color.name)}"
      ></button>
    `;
  }).join('');

  // Event listeners para selección de color
  container.querySelectorAll('.color-swatch-circle').forEach(btn => {
    btn.onclick = () => {
      const colorName = btn.dataset.colorName;
      const found = product.colors.find(c => c.name === colorName);
      if (found) {
        selectedColor = found;
        if (colorNameLabel) colorNameLabel.textContent = found.name;
        container.querySelectorAll('.color-swatch-circle').forEach(b => b.classList.remove('is-selected'));
        btn.classList.add('is-selected');

        // Si el color tiene una foto asociada, mover la galería a ella
        if (found.imageIndex !== undefined && productImages[found.imageIndex]) {
          currentPhotoIndex = found.imageIndex;
          renderGallery();
        }

        updateStockAndBuyState();
      }
    };
  });
}

/**
 * Renderiza el selector circular de tallas (44x44px con tachado diagonal 45° si agotada)
 */
function renderSizes(product) {
  const sizesSection = document.getElementById('pdp-sizes-section');
  const container = document.getElementById('pdp-sizes-container');
  const sizeNameLabel = document.getElementById('pdp-selected-size-name');

  if (!sizesSection || !container) return;

  // Si la prenda no tiene tallas (hasSizes === false), ocultamos la sección
  if (product.hasSizes === false) {
    sizesSection.style.display = 'none';
    selectedSize = 'ÚNICA';
    return;
  }

  sizesSection.style.display = 'block';
  if (sizeNameLabel) {
    sizeNameLabel.textContent = selectedSize || '--';
  }

  const variants = product.variants || [];
  container.innerHTML = variants.map(v => {
    const isSelected = v.size === selectedSize;
    const isOut = (v.stock <= 0);
    const selectedClass = isSelected ? 'is-selected' : '';
    const outClass = isOut ? 'is-out' : '';

    return `
      <button 
        type="button" 
        class="size-circle-btn ${selectedClass} ${outClass}" 
        data-size="${escapeHtml(v.size)}" 
        title="Talla ${escapeHtml(v.size)}${isOut ? ' (Agotada)' : ''}" 
        aria-label="Talla ${escapeHtml(v.size)}"
      >
        ${escapeHtml(v.size)}
      </button>
    `;
  }).join('');

  // Event listeners de selección de talla
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
 * Determina el stock disponible para la talla y color actuales y actualiza el estado de compra
 */
function getSelectedStock() {
  if (!currentProduct) return 0;

  // Si el color seleccionado está marcado como fuera de stock, stock es 0
  if (selectedColor && selectedColor.inStock === false) {
    return 0;
  }

  // Si la prenda no tiene tallas, calcular suma total de variantes
  if (currentProduct.hasSizes === false) {
    if (currentProduct.variants && currentProduct.variants.length > 0) {
      return currentProduct.variants.reduce((acc, v) => acc + (v.stock || 0), 0);
    }
    return 0;
  }

  // Si tiene tallas, buscar la variante seleccionada
  const variant = (currentProduct.variants || []).find(v => v.size === selectedSize);
  return variant ? variant.stock : 0;
}

/**
 * Actualiza los indicadores visuales de stock, botón de carrito y botón exprés Bizum
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
      stockLabel.textContent = 'Agotado';
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

  // Ajustar cantidad si excede el stock
  if (isAvailable && currentQuantity > stock) {
    currentQuantity = stock;
    const qtyVal = document.getElementById('pdp-qty-val');
    if (qtyVal) qtyVal.textContent = currentQuantity;
  }
}

/**
 * Configura el stepper de cantidad (112px con [-] y [+])
 */
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

/**
 * Configura las acciones de compra: Añadir al carrito y Comprar con Bizum / Tarjeta
 */
function setupActionButtons() {
  const addCartBtn = document.getElementById('btn-pdp-add-cart');
  const expressBtn = document.getElementById('btn-pdp-express');

  if (addCartBtn) {
    addCartBtn.onclick = () => {
      if (!currentProduct) return;
      const stock = getSelectedStock();
      if (stock <= 0) return;

      const sizeToAdd = (currentProduct.hasSizes === false) ? 'ÚNICA' : selectedSize;
      const colorToAdd = selectedColor ? selectedColor.name : null;

      addToCart(currentProduct, sizeToAdd, currentQuantity, colorToAdd);
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
      const colorToAdd = selectedColor ? selectedColor.name : null;

      addToCart(currentProduct, sizeToAdd, currentQuantity, colorToAdd);
      updateCartBadges();

      // Redirigir directamente al checkout
      window.location.href = 'checkout.html';
    };
  }
}

/**
 * Configura los botones de Compartir y Pregunta por WhatsApp
 */
function setupUtilityLinks(product) {
  const shareBtn = document.getElementById('pdp-share-btn');
  if (shareBtn) {
    shareBtn.onclick = async () => {
      const shareData = {
        title: `${product.title} | Yoana Zafiro`,
        text: `Descubre esta prenda en Yoana Zafiro: ${product.title} - ${formatPrice(product.price)}`,
        url: window.location.href
      };

      if (navigator.share) {
        try {
          await navigator.share(shareData);
        } catch (err) {
          // El usuario canceló la acción nativa
        }
      } else {
        // Fallback al portapapeles
        try {
          await navigator.clipboard.writeText(window.location.href);
          const originalText = shareBtn.querySelector('span').textContent;
          shareBtn.querySelector('span').textContent = '¡Enlace copiado!';
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

/**
 * Carga prendas recomendadas para el carrusel inferior
 */
async function loadRelatedProducts(product) {
  const track = document.getElementById('related-track');
  if (!track) return;

  try {
    const related = await getRelatedProducts(product.id, 4);
    if (!related || related.length === 0) {
      const section = track.closest('.related-products-section');
      if (section) section.style.display = 'none';
      return;
    }

    track.innerHTML = related.map(item => renderProductCardMarkup(item)).join('');
    bindProductCardEvents(track, (addedProduct) => {
      renderCartDrawer();
      updateCartBadges();
      openCartDrawer();
    });
  } catch (err) {
    console.error("[ProductPage] Error al cargar productos relacionados:", err);
  }
}

/**
 * Escucha cambios en tiempo real del catálogo desde el panel de administración
 * vía BroadcastChannel y Storage Event para actualizar la vista sin recargar
 */
function setupLiveSync() {
  onStoreDataChanged(async () => {
    if (!currentProduct) return;
    try {
      const refreshed = await getProductByIdOrSlug(currentProduct.id);
      if (refreshed) {
        currentProduct = refreshed;
        initProductPage(refreshed);
      }
    } catch (e) {
      console.warn("[ProductPage] Error actualizando producto en vivo:", e);
    }
  });
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
