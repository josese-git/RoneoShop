/**
 * UI CONTROLLER - ANATOMÍA COMPLETA DE 13 SECCIONES (FASE 2)
 * Controla la interactividad de las 13 secciones, filtros multirrubro (Ropa, Cabello, Cosmética),
 * carrusel de colecciones, modales Bottom-Sheet y barra de 5 botones.
 */

import { getStoreSettings, getProducts } from './store-service.js';
import {
  getCart,
  addToCart,
  updateCartItemQuantity,
  removeFromCart,
  getCartTotals
} from './cart.js';

/**
 * Formateador oficial de precios estilo Yoana Zafiro (€ delante y coma decimal)
 * Ejemplo: €24,95
 */
export const formatPrice = (amount) => {
  const num = Number(amount || 0);
  return '€' + num.toFixed(2).replace('.', ',');
};

// Estado global de la interfaz
let currentSettings = null;
let allProducts = [];
let activeCategory = 'ropa';
let isGridMode = false;
let searchQuery = '';

// Estado del Bottom-Sheet Quick Add
let modalProduct = null;
let modalSelectedSize = null;

/**
 * Inicialización al cargar el DOM
 */
document.addEventListener('DOMContentLoaded', async () => {
  try {
    const [settings, products] = await Promise.all([
      getStoreSettings(),
      getProducts()
    ]);

    currentSettings = settings;
    allProducts = products;

    setupAnnouncement(settings.announcementText);
    renderCategoryTabs(settings.categories);
    renderProducts();
    renderDuoProducts();
    setupEventListeners();
    renderCartDrawer();
    updateCartBadges();
  } catch (err) {
    console.error("[UI] Error durante la inicialización:", err);
  }
});

/**
 * Configura el texto de la Announcement Bar
 */
function setupAnnouncement(text) {
  const el = document.getElementById('announcement-text');
  if (el && text) {
    el.textContent = text;
  }
}

/**
 * Renderiza las pestañas Serif superiores
 */
function renderCategoryTabs(categories) {
  const container = document.getElementById('category-tabs');
  if (!container) return;

  const list = categories && categories.length > 0
    ? categories
    : ["ropa", "cabello", "cosmetica", "novedades", "vestidos", "abrigos", "vaqueros", "rebajas"];

  container.innerHTML = list.map(cat => {
    const isActive = cat.toLowerCase() === activeCategory.toLowerCase();
    return `
      <button 
        type="button" 
        class="category-tab ${isActive ? 'is-active' : ''}" 
        data-category="${cat}">
        ${cat.toUpperCase()}
      </button>
    `;
  }).join('');

  container.querySelectorAll('.category-tab').forEach(tab => {
    tab.addEventListener('click', (e) => {
      setCategory(e.currentTarget.dataset.category.toLowerCase());
    });
  });
}

/**
 * Cambia la categoría activa, sincroniza pestañas y re-renderiza el catálogo
 */
export function setCategory(categoryName, shouldScroll = false) {
  activeCategory = categoryName.toLowerCase();
  searchQuery = '';

  const searchInput = document.getElementById('search-input');
  if (searchInput) searchInput.value = '';

  const tabsContainer = document.getElementById('category-tabs');
  if (tabsContainer) {
    tabsContainer.querySelectorAll('.category-tab').forEach(t => {
      if (t.dataset.category.toLowerCase() === activeCategory) {
        t.classList.add('is-active');
        t.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      } else {
        t.classList.remove('is-active');
      }
    });
  }

  renderProducts();

  if (shouldScroll) {
    const section = document.getElementById('products-section');
    if (section) {
      section.scrollIntoView({ behavior: 'smooth' });
    }
  }
}

/**
 * Renderiza los productos en el carrusel o cuadrícula según la categoría activa
 */
function renderProducts() {
  const track = document.getElementById('products-track');
  const viewAllBtn = document.getElementById('view-all-btn');
  if (!track) return;

  let filtered = [...allProducts];

  if (searchQuery.trim() !== '') {
    const q = searchQuery.toLowerCase().trim();
    filtered = filtered.filter(p => 
      p.title.toLowerCase().includes(q) || 
      p.category.toLowerCase().includes(q) ||
      (p.subcategory && p.subcategory.toLowerCase().includes(q)) ||
      (p.description && p.description.toLowerCase().includes(q))
    );
  } else if (activeCategory === 'rebajas') {
    filtered = filtered.filter(p => p.compareAtPrice && p.compareAtPrice > p.price);
  } else if (activeCategory === 'ropa') {
    filtered = filtered.filter(p => p.category.toLowerCase() === 'ropa');
  } else if (activeCategory === 'cabello') {
    filtered = filtered.filter(p => p.category.toLowerCase() === 'cabello');
  } else if (activeCategory === 'cosmetica') {
    filtered = filtered.filter(p => p.category.toLowerCase() === 'cosmetica');
  } else {
    filtered = filtered.filter(p => 
      p.category.toLowerCase() === activeCategory || 
      (p.subcategory && p.subcategory.toLowerCase() === activeCategory)
    );
  }

  // Alternancia de clases
  if (isGridMode) {
    track.className = 'products-track--grid';
    if (viewAllBtn) viewAllBtn.textContent = 'VER MODO CARRUSEL';
  } else {
    track.className = 'products-track--carousel';
    if (viewAllBtn) viewAllBtn.textContent = 'VER TODO';
  }

  if (filtered.length === 0) {
    track.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 3rem 1rem; color: var(--color-text-muted);">
        <p style="font-size: 14px; margin-bottom: 12px;">No se encontraron artículos en esta sección.</p>
        <button type="button" class="btn-primary" id="btn-reset-catalog" style="max-width: 200px; margin: 0 auto; padding: 10px 16px;">Ver Toda la Ropa</button>
      </div>
    `;
    const resetBtn = document.getElementById('btn-reset-catalog');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => setCategory('ropa'));
    }
    return;
  }

  track.innerHTML = filtered.map(product => {
    const totalStock = product.variants ? product.variants.reduce((sum, v) => sum + v.stock, 0) : 0;
    const isSoldOut = totalStock <= 0;
    const hasDiscount = product.compareAtPrice && product.compareAtPrice > product.price;
    const discountPercent = hasDiscount
      ? Math.round(((product.compareAtPrice - product.price) / product.compareAtPrice) * 100)
      : 0;

    const mainImage = product.images?.[0] || '';

    return `
      <article class="product-card js-product-card" data-id="${product.id}">
        <div class="product-card__media">
          <img 
            class="product-card__img" 
            src="${mainImage}" 
            alt="${product.title}" 
            loading="lazy" 
          />
          
          ${isSoldOut ? `<span class="product-card__badge badge--soldout">Agotado</span>` : ''}
          ${(!isSoldOut && hasDiscount) ? `<span class="product-card__badge badge--sale">-${discountPercent}%</span>` : ''}

          <button 
            type="button" 
            class="product-card__bag-btn js-open-quick-add" 
            data-id="${product.id}" 
            aria-label="Añadir ${product.title} a la cesta">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path>
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <path d="M16 10a4 4 0 0 1-8 0"></path>
            </svg>
          </button>
        </div>

        <div class="product-card__info">
          <h3 class="product-card__title">${product.title}</h3>
          <div class="product-card__price-row">
            ${hasDiscount ? `<span class="price--compare">${formatPrice(product.compareAtPrice)}</span>` : ''}
            <span>${formatPrice(product.price)}</span>
          </div>
        </div>
      </article>
    `;
  }).join('');

  bindProductCardEvents(track);
}

/**
 * Renderiza el Grid de 2 productos destacados en la Sección 9 (Cabello)
 */
function renderDuoProducts() {
  const container = document.getElementById('duo-products-container');
  if (!container) return;

  const p1 = allProducts.find(p => p.id === 'champu-nutritivo-1000ml');
  const p2 = allProducts.find(p => p.id === 'secador-profesional-ionic');

  const duoList = [p1, p2].filter(Boolean);

  container.innerHTML = duoList.map(product => {
    const totalStock = product.variants ? product.variants.reduce((sum, v) => sum + v.stock, 0) : 0;
    const isSoldOut = totalStock <= 0;
    const hasDiscount = product.compareAtPrice && product.compareAtPrice > product.price;
    const discountPercent = hasDiscount
      ? Math.round(((product.compareAtPrice - product.price) / product.compareAtPrice) * 100)
      : 0;

    return `
      <article class="product-card js-product-card" data-id="${product.id}">
        <div class="product-card__media">
          <img class="product-card__img" src="${product.images[0]}" alt="${product.title}" loading="lazy" />
          ${isSoldOut ? `<span class="product-card__badge badge--soldout">Agotado</span>` : ''}
          ${(!isSoldOut && hasDiscount) ? `<span class="product-card__badge badge--sale">-${discountPercent}%</span>` : ''}
          <button type="button" class="product-card__bag-btn js-open-quick-add" data-id="${product.id}" aria-label="Añadir a la cesta">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path>
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <path d="M16 10a4 4 0 0 1-8 0"></path>
            </svg>
          </button>
        </div>
        <div class="product-card__info">
          <h3 class="product-card__title">${product.title}</h3>
          <div class="product-card__price-row">
            ${hasDiscount ? `<span class="price--compare">${formatPrice(product.compareAtPrice)}</span>` : ''}
            <span>${formatPrice(product.price)}</span>
          </div>
        </div>
      </article>
    `;
  }).join('');

  bindProductCardEvents(container);
}

/**
 * Asocia listeners para abrir el Bottom Sheet modal
 */
function bindProductCardEvents(parentElement) {
  parentElement.querySelectorAll('.js-open-quick-add').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const p = allProducts.find(item => item.id === btn.dataset.id);
      if (p) openQuickAddSheet(p);
    });
  });

  parentElement.querySelectorAll('.js-product-card').forEach(card => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('.js-open-quick-add')) return;
      const p = allProducts.find(item => item.id === card.dataset.id);
      if (p) openQuickAddSheet(p);
    });
  });
}

/**
 * Abre el Bottom-Sheet modal para elegir talla
 */
export function openQuickAddSheet(product) {
  modalProduct = product;

  const firstAvailable = product.variants?.find(v => v.stock > 0);
  modalSelectedSize = firstAvailable ? firstAvailable.size : (product.variants?.[0]?.size || null);

  const sheet = document.getElementById('quick-add-sheet');
  const overlay = document.getElementById('sheet-overlay');
  if (!sheet || !overlay) return;

  const imgEl = document.getElementById('modal-sheet-img');
  if (imgEl) {
    imgEl.src = product.images?.[0] || '';
    imgEl.alt = product.title;
  }

  const titleEl = document.getElementById('modal-sheet-title');
  if (titleEl) titleEl.textContent = product.title;

  const priceEl = document.getElementById('modal-sheet-price');
  if (priceEl) {
    const hasDiscount = product.compareAtPrice && product.compareAtPrice > product.price;
    priceEl.innerHTML = `
      ${hasDiscount ? `<span class="price--compare" style="margin-right: 6px;">${formatPrice(product.compareAtPrice)}</span>` : ''}
      <span>${formatPrice(product.price)}</span>
    `;
  }

  renderModalSizePills();
  updateModalWarningAndButton();

  sheet.classList.add('is-open');
  overlay.classList.add('is-open');
  document.body.classList.add('overflow-hidden');
}

/**
 * Cierra el Bottom-Sheet modal
 */
export function closeQuickAddSheet() {
  const sheet = document.getElementById('quick-add-sheet');
  const overlay = document.getElementById('sheet-overlay');
  if (sheet) sheet.classList.remove('is-open');
  if (overlay) overlay.classList.remove('is-open');
  
  const cartDrawer = document.getElementById('cart-drawer');
  const infoModal = document.getElementById('info-modal');
  if ((!cartDrawer || !cartDrawer.classList.contains('is-open')) &&
      (!infoModal || !infoModal.classList.contains('is-open'))) {
    document.body.classList.remove('overflow-hidden');
  }
  modalProduct = null;
}

/**
 * Renderiza las píldoras de talla en el modal
 */
function renderModalSizePills() {
  const container = document.getElementById('modal-size-pills');
  if (!container || !modalProduct) return;

  const variants = modalProduct.variants || [];

  container.innerHTML = variants.map(v => {
    const isOut = v.stock <= 0;
    const isSelected = v.size === modalSelectedSize && !isOut;
    return `
      <button 
        type="button" 
        class="size-pill ${isSelected ? 'is-selected' : ''} ${isOut ? 'is-disabled' : ''}" 
        data-size="${v.size}"
        ${isOut ? 'disabled' : ''}>
        ${v.size}
      </button>
    `;
  }).join('');

  container.querySelectorAll('.size-pill:not(.is-disabled)').forEach(btn => {
    btn.addEventListener('click', () => {
      modalSelectedSize = btn.dataset.size;
      renderModalSizePills();
      updateModalWarningAndButton();
    });
  });
}

/**
 * Actualiza la advertencia de stock bajo y el estado del botón añadir
 */
function updateModalWarningAndButton() {
  const warningEl = document.getElementById('modal-stock-warning');
  const addBtn = document.getElementById('modal-btn-add');

  const variant = modalProduct?.variants?.find(v => v.size === modalSelectedSize);
  const stock = variant ? variant.stock : 0;

  if (warningEl) {
    if (stock >= 1 && stock <= 3) {
      warningEl.textContent = `¡Solo quedan ${stock} ${stock === 1 ? 'unidad' : 'unidades'}!`;
      warningEl.classList.add('is-visible');
    } else {
      warningEl.classList.remove('is-visible');
    }
  }

  if (addBtn) {
    if (stock <= 0) {
      addBtn.textContent = 'Agotado';
      addBtn.disabled = true;
    } else {
      addBtn.textContent = 'Añadir a la cesta';
      addBtn.disabled = false;
    }
  }
}

/**
 * Renderiza el Cart Drawer con barra de progreso de envío gratis
 */
function renderCartDrawer() {
  const drawer = document.getElementById('cart-drawer');
  if (!drawer) return;

  const cart = getCart();
  const threshold = currentSettings?.freeShippingThreshold || 60.00;
  const shippingPrice = currentSettings?.shippingStandardPrice || 4.90;
  const totals = getCartTotals(threshold, shippingPrice);

  const titleEl = document.getElementById('cart-drawer-title');
  if (titleEl) {
    titleEl.textContent = `Tu cesta (${totals.totalItems})`;
  }

  const shippingTextEl = document.getElementById('cart-free-shipping-text');
  const progressFillEl = document.getElementById('cart-progress-fill');

  if (shippingTextEl && progressFillEl) {
    if (totals.totalItems === 0) {
      shippingTextEl.textContent = `ENVÍO GRATIS EN PEDIDOS SUPERIORES A ${formatPrice(threshold)}`;
      progressFillEl.style.width = '0%';
    } else if (totals.hasFreeShipping) {
      shippingTextEl.textContent = '¡Enhorabuena! Tienes ENVÍO GRATIS ✨';
      progressFillEl.style.width = '100%';
    } else {
      shippingTextEl.textContent = `Te faltan ${formatPrice(totals.remainingForFreeShipping)} para tener ENVÍO GRATIS`;
      progressFillEl.style.width = `${totals.freeShippingProgressPercent}%`;
    }
  }

  const itemsContainer = document.getElementById('cart-drawer-items');
  const emptyContainer = document.getElementById('cart-drawer-empty');
  const footerContainer = document.getElementById('cart-drawer-footer');

  if (cart.length === 0) {
    if (itemsContainer) itemsContainer.style.display = 'none';
    if (emptyContainer) emptyContainer.style.display = 'flex';
    if (footerContainer) footerContainer.style.display = 'none';
  } else {
    if (itemsContainer) itemsContainer.style.display = 'flex';
    if (emptyContainer) emptyContainer.style.display = 'none';
    if (footerContainer) footerContainer.style.display = 'block';

    if (itemsContainer) {
      itemsContainer.innerHTML = cart.map(item => `
        <div class="cart-drawer-item">
          <div class="cart-drawer-item__media">
            <img src="${item.image}" alt="${item.title}" loading="lazy" />
          </div>
          <div class="cart-drawer-item__info">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px;">
              <h4 class="cart-drawer-item__title">${item.title}</h4>
              <button 
                type="button" 
                class="js-cart-remove" 
                data-cart-item-id="${item.cartItemId}" 
                style="color: var(--color-text-muted); padding: 2px;" 
                aria-label="Eliminar ${item.title}">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
              </button>
            </div>
            <div class="cart-drawer-item__size">Talla: ${item.size}</div>
            <div class="cart-drawer-item__actions">
              <div class="cart-item-stepper">
                <button type="button" class="js-cart-minus" data-cart-item-id="${item.cartItemId}" ${item.quantity <= 1 ? 'disabled' : ''}>-</button>
                <span>${item.quantity}</span>
                <button type="button" class="js-cart-plus" data-cart-item-id="${item.cartItemId}" ${item.quantity >= item.maxStock ? 'disabled' : ''}>+</button>
              </div>
              <div class="cart-drawer-item__price">${formatPrice(item.price * item.quantity)}</div>
            </div>
          </div>
        </div>
      `).join('');

      itemsContainer.querySelectorAll('.js-cart-remove').forEach(btn => {
        btn.addEventListener('click', () => removeFromCart(btn.dataset.cartItemId));
      });

      itemsContainer.querySelectorAll('.js-cart-minus').forEach(btn => {
        btn.addEventListener('click', () => {
          const item = cart.find(i => i.cartItemId === btn.dataset.cartItemId);
          if (item) updateCartItemQuantity(item.cartItemId, item.quantity - 1);
        });
      });

      itemsContainer.querySelectorAll('.js-cart-plus').forEach(btn => {
        btn.addEventListener('click', () => {
          const item = cart.find(i => i.cartItemId === btn.dataset.cartItemId);
          if (item) updateCartItemQuantity(item.cartItemId, item.quantity + 1);
        });
      });
    }

    const subtotalEl = document.getElementById('cart-drawer-subtotal');
    if (subtotalEl) {
      subtotalEl.textContent = formatPrice(totals.subtotal);
    }
  }
}

/**
 * Abre el panel lateral del carrito
 */
export function openCartDrawer() {
  const drawer = document.getElementById('cart-drawer');
  const overlay = document.getElementById('sheet-overlay');
  if (drawer && overlay) {
    drawer.classList.add('is-open');
    overlay.classList.add('is-open');
    document.body.classList.add('overflow-hidden');
  }
}

/**
 * Cierra el panel lateral del carrito
 */
export function closeCartDrawer() {
  const drawer = document.getElementById('cart-drawer');
  const overlay = document.getElementById('sheet-overlay');
  if (drawer) drawer.classList.remove('is-open');
  if (overlay) overlay.classList.remove('is-open');
  document.body.classList.remove('overflow-hidden');
}

/**
 * Actualiza los badges de carrito en Header y barra inferior
 */
function updateCartBadges() {
  const totals = getCartTotals();
  
  const headerBadge = document.getElementById('header-cart-badge');
  if (headerBadge) {
    headerBadge.textContent = totals.totalItems;
    if (totals.totalItems > 0) {
      headerBadge.classList.remove('is-empty');
    } else {
      headerBadge.classList.add('is-empty');
    }
  }

  const bottomBadge = document.getElementById('bottom-tab-badge');
  if (bottomBadge) {
    bottomBadge.textContent = totals.totalItems;
    if (totals.totalItems > 0) {
      bottomBadge.classList.remove('is-empty');
    } else {
      bottomBadge.classList.add('is-empty');
    }
  }
}

/**
 * Despliega o repliega el buscador superior
 */
function toggleSearchBar(forceOpen = null) {
  const drawer = document.getElementById('search-bar-drawer');
  const input = document.getElementById('search-input');
  if (!drawer) return;

  const shouldOpen = forceOpen !== null ? forceOpen : !drawer.classList.contains('is-open');
  if (shouldOpen) {
    drawer.classList.add('is-open');
    if (input) setTimeout(() => input.focus(), 150);
  } else {
    drawer.classList.remove('is-open');
    if (input) input.blur();
  }
}

/**
 * Abre el Modal de Información
 */
function openInfoModal() {
  const modal = document.getElementById('info-modal');
  const overlay = document.getElementById('sheet-overlay');
  if (modal && overlay) {
    modal.classList.add('is-open');
    overlay.classList.add('is-open');
    document.body.classList.add('overflow-hidden');
  }
}

/**
 * Cierra el Modal de Información
 */
function closeInfoModal() {
  const modal = document.getElementById('info-modal');
  const overlay = document.getElementById('sheet-overlay');
  if (modal) modal.classList.remove('is-open');
  if (overlay) overlay.classList.remove('is-open');
  document.body.classList.remove('overflow-hidden');
}

/**
 * Abre el Menú Lateral Izquierdo
 */
function openHamburgerMenu() {
  const menu = document.getElementById('hamburger-menu');
  const overlay = document.getElementById('sheet-overlay');
  if (menu && overlay) {
    menu.classList.add('is-open');
    overlay.classList.add('is-open');
    document.body.classList.add('overflow-hidden');
  }
}

/**
 * Cierra el Menú Lateral Izquierdo
 */
function closeHamburgerMenu() {
  const menu = document.getElementById('hamburger-menu');
  const overlay = document.getElementById('sheet-overlay');
  if (menu) menu.classList.remove('is-open');
  if (overlay) overlay.classList.remove('is-open');
  document.body.classList.remove('overflow-hidden');
}

/**
 * Configuración de listeners globales
 */
function setupEventListeners() {
  // Sincronización reactiva del carrito
  window.addEventListener('cart:updated', (e) => {
    renderCartDrawer();
    updateCartBadges();
    if (e.detail?.openDrawer) {
      openCartDrawer();
    }
  });

  // Botón "VER TODO" / "VER MODO CARRUSEL"
  const viewAllBtn = document.getElementById('view-all-btn');
  if (viewAllBtn) {
    viewAllBtn.addEventListener('click', () => {
      isGridMode = !isGridMode;
      renderProducts();
    });
  }

  // Buscador en vivo
  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value;
      renderProducts();
    });
  }

  const searchCloseBtn = document.getElementById('search-close-btn');
  if (searchCloseBtn) {
    searchCloseBtn.addEventListener('click', () => {
      if (searchInput) searchInput.value = '';
      searchQuery = '';
      toggleSearchBar(false);
      renderProducts();
    });
  }

  const headerSearchBtn = document.getElementById('header-search-btn');
  if (headerSearchBtn) {
    headerSearchBtn.addEventListener('click', () => toggleSearchBar());
  }

  // Header Cesta & Hamburguesa
  const headerCartBtn = document.getElementById('header-cart-btn');
  if (headerCartBtn) {
    headerCartBtn.addEventListener('click', () => openCartDrawer());
  }

  const headerMenuBtn = document.getElementById('header-menu-btn');
  if (headerMenuBtn) {
    headerMenuBtn.addEventListener('click', () => openHamburgerMenu());
  }

  const hamburgerCloseBtn = document.getElementById('hamburger-close-btn');
  if (hamburgerCloseBtn) {
    hamburgerCloseBtn.addEventListener('click', () => closeHamburgerMenu());
  }

  // Links del Menú Lateral
  document.querySelectorAll('.hamburger-drawer__link').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const cat = link.dataset.category;
      if (cat) setCategory(cat, true);
      closeHamburgerMenu();
    });
  });

  // SECCIÓN 4: Tarjetas del Carrusel de Colecciones
  document.querySelectorAll('.js-collection-filter').forEach(card => {
    card.addEventListener('click', (e) => {
      e.preventDefault();
      const cat = card.dataset.category;
      if (cat) setCategory(cat, true);
    });
  });

  // SECCIONES 6, 7, 8, 9, 10, 11: Botones de los bloques editoriales
  const btnExploreAutumn = document.getElementById('btn-explore-autumn');
  if (btnExploreAutumn) {
    btnExploreAutumn.addEventListener('click', () => setCategory('abrigos', true));
  }

  const btnExploreSpring = document.getElementById('btn-explore-spring');
  if (btnExploreSpring) {
    btnExploreSpring.addEventListener('click', () => setCategory('vestidos', true));
  }

  const btnBuyKorean = document.getElementById('btn-buy-korean');
  if (btnBuyKorean) {
    btnBuyKorean.addEventListener('click', () => setCategory('cosmetica', true));
  }

  const btnSeeHairProducts = document.getElementById('btn-see-hair-products');
  if (btnSeeHairProducts) {
    btnSeeHairProducts.addEventListener('click', () => setCategory('cabello', true));
  }

  const btnBuyHairTreatment = document.getElementById('btn-buy-hair-treatment');
  if (btnBuyHairTreatment) {
    btnBuyHairTreatment.addEventListener('click', () => setCategory('cabello', true));
  }

  const btnPeikas = document.getElementById('btn-peikas');
  if (btnPeikas) {
    btnPeikas.addEventListener('click', () => {
      window.open('https://peikas.com/', '_blank');
    });
  }

  // SECCIÓN 9: Reproductor de vídeo interactivo
  const videoPlayOverlay = document.getElementById('video-play-overlay');
  const showcaseVideo = document.getElementById('showcase-video');
  if (videoPlayOverlay && showcaseVideo) {
    videoPlayOverlay.addEventListener('click', () => {
      if (showcaseVideo.paused) {
        showcaseVideo.play();
        videoPlayOverlay.style.opacity = '0';
        videoPlayOverlay.style.pointerEvents = 'none';
        showcaseVideo.setAttribute('controls', 'true');
      }
    });
  }

  // BARRA DE NAVEGACIÓN FIJA INFERIOR (5 BOTONES)
  const tabHome = document.getElementById('bottom-tab-home');
  if (tabHome) {
    tabHome.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      isGridMode = false;
      setCategory('ropa');
    });
  }

  const tabBuscar = document.getElementById('bottom-tab-buscar');
  if (tabBuscar) {
    tabBuscar.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      toggleSearchBar(true);
    });
  }

  const tabCarro = document.getElementById('bottom-tab-carro');
  if (tabCarro) {
    tabCarro.addEventListener('click', () => openCartDrawer());
  }

  const tabProductos = document.getElementById('bottom-tab-productos');
  if (tabProductos) {
    tabProductos.addEventListener('click', () => {
      isGridMode = true;
      renderProducts();
      const section = document.getElementById('products-section');
      if (section) section.scrollIntoView({ behavior: 'smooth' });
    });
  }

  const tabInfo = document.getElementById('bottom-tab-info');
  if (tabInfo) {
    tabInfo.addEventListener('click', () => openInfoModal());
  }

  // Cierre de modales con el overlay
  const sheetOverlay = document.getElementById('sheet-overlay');
  if (sheetOverlay) {
    sheetOverlay.addEventListener('click', () => {
      closeQuickAddSheet();
      closeCartDrawer();
      closeInfoModal();
      closeHamburgerMenu();
    });
  }

  const sheetCloseBtn = document.getElementById('sheet-close-btn');
  if (sheetCloseBtn) sheetCloseBtn.addEventListener('click', closeQuickAddSheet);

  const infoCloseBtn = document.getElementById('info-close-btn');
  if (infoCloseBtn) infoCloseBtn.addEventListener('click', closeInfoModal);

  const cartDrawerClose = document.getElementById('cart-drawer-close');
  if (cartDrawerClose) cartDrawerClose.addEventListener('click', closeCartDrawer);

  const cartContinueBtn = document.getElementById('cart-empty-continue');
  if (cartContinueBtn) cartContinueBtn.addEventListener('click', closeCartDrawer);

  // Botón "Añadir a la cesta" en el Modal
  const modalAddBtn = document.getElementById('modal-btn-add');
  if (modalAddBtn) {
    modalAddBtn.addEventListener('click', () => {
      if (!modalProduct || !modalSelectedSize) return;
      const success = addToCart(modalProduct, modalSelectedSize, 1);
      if (success) {
        closeQuickAddSheet();
        openCartDrawer();
      }
    });
  }

  // Botón Checkout
  const checkoutBtn = document.getElementById('cart-checkout-btn');
  if (checkoutBtn) {
    checkoutBtn.addEventListener('click', () => {
      window.location.href = 'checkout.html';
    });
  }

  // Tecla Escape
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeQuickAddSheet();
      closeCartDrawer();
      closeInfoModal();
      closeHamburgerMenu();
      toggleSearchBar(false);
    }
  });
}
