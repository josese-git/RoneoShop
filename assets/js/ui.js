/**
 * UI CONTROLLER - ANATOMÍA COMPLETA Y NAVEGACIÓN GLOBAL (FASE 4.3)
 * Controla la interactividad de la tienda, navegación global (Menú Hamburger,
 * barra inferior de 5 botones, buscador desplegable, cart drawer y modal de info),
 * carrusel dinámico de colecciones, pestañas de categorías y Quick-Add.
 * Sincronización reactiva en tiempo real (< 100ms) mediante onSnapshot.
 * Zero Emojis · 100% Iconos Vectoriales SVG.
 */

import {
  getStoreSettings,
  getProducts,
  subscribeToProducts,
  subscribeToSettings,
  DEFAULT_CATEGORIES,
  DEFAULT_COLLECTIONS,
  getCollections
} from './store-service.js';
import {
  getCart,
  addToCart,
  updateCartItemQuantity,
  removeFromCart,
  getCartTotals
} from './cart.js';

/**
 * Formateador oficial de precios de Roneo Shop (€ delante y coma decimal)
 */
export const formatPrice = (amount) => {
  const num = Number(amount || 0);
  return '€' + num.toFixed(2).replace('.', ',');
};

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Estado global de la interfaz
let currentSettings = null;
let allProducts = [];
let activeCategory = 'ropa';
let isGridMode = false;
let searchQuery = '';

// Estado del Bottom-Sheet Quick Add
let modalProduct = null;
let modalSelectedColor = null;
let modalSelectedSize = null;

// Suscripciones en vivo
let unsubscribeProducts = null;
let unsubscribeSettings = null;

/**
 * Genera el markup HTML estandarizado para una tarjeta de producto (Mobile-First)
 */
export function renderProductCardMarkup(product) {
  const totalStock = product.totalStock ?? (product.variants ? product.variants.reduce((sum, v) => sum + v.stock, 0) : 0);
  const isSoldOut = totalStock <= 0;
  const hasDiscount = product.compareAtPrice && product.compareAtPrice > product.price;
  const discountPercent = hasDiscount
    ? Math.round(((product.compareAtPrice - product.price) / product.compareAtPrice) * 100)
    : 0;

  const mainImage = product.images?.[0] || 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=600&q=80';
  const productUrl = `product.html?id=${encodeURIComponent(product.id)}`;

  return `
    <article class="product-card js-product-card" data-id="${product.id}">
      <div class="product-card__media">
        <a href="${productUrl}" class="product-card__media-link" aria-label="Ver detalles de ${escapeHtml(product.title)}">
          <img 
            class="product-card__img" 
            src="${escapeHtml(mainImage)}" 
            alt="${escapeHtml(product.title)}" 
            loading="lazy" 
          />
        </a>
        
        ${isSoldOut ? `<span class="product-card__badge badge--soldout">Agotado</span>` : ''}
        ${(!isSoldOut && hasDiscount) ? `<span class="product-card__badge badge--sale">-${discountPercent}%</span>` : ''}

        <button 
          type="button" 
          class="product-card__bag-btn js-open-quick-add" 
          data-id="${product.id}" 
          aria-label="Añadir ${escapeHtml(product.title)} a la cesta">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
            <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path>
            <line x1="3" y1="6" x2="21" y2="6"></line>
            <path d="M16 10a4 4 0 0 1-8 0"></path>
          </svg>
        </button>
      </div>

      <div class="product-card__info">
        <h3 class="product-card__title">
          <a href="${productUrl}" class="product-card__title-link">${escapeHtml(product.title)}</a>
        </h3>
        <div class="product-card__price-row">
          ${hasDiscount ? `<span class="price--compare">${formatPrice(product.compareAtPrice)}</span>` : ''}
          <span>${formatPrice(product.price)}</span>
        </div>
      </div>
    </article>
  `;
}

/**
 * Asocia listeners para la tarjeta de producto
 */
export function bindProductCardEvents(parentElement, productsList = allProducts) {
  if (!parentElement) return;

  parentElement.querySelectorAll('.js-open-quick-add').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const p = productsList.find(item => item.id === btn.dataset.id);
      if (p) openQuickAddSheet(p);
    });
  });

  parentElement.querySelectorAll('.js-product-card').forEach(card => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('.js-open-quick-add')) return;
      const targetLink = e.target.closest('a');
      if (!targetLink) {
        window.location.href = `product.html?id=${encodeURIComponent(card.dataset.id)}`;
      }
    });
  });
}

/**
 * --------------------------------------------------------------------------
 * FASE 4.3: AUTO-INYECCIÓN Y REPARACIÓN INTEGRAL DE NAVEGACIÓN GLOBAL
 * --------------------------------------------------------------------------
 */

export function ensureGlobalShellElements() {
  if (!document.body) return;

  // 1. Drawer Lateral Izquierdo (Menú Hamburger) + Overlay
  if (!document.getElementById('mobile-menu-drawer') && !document.getElementById('hamburger-menu')) {
    const drawerHtml = `
      <aside id="mobile-menu-drawer" class="mobile-menu-drawer" role="dialog" aria-modal="true" aria-label="Menú de navegación">
        <div class="mobile-menu-header">
          <h3 class="mobile-menu-title" data-setting="store-name">Roneo Shop</h3>
          <button type="button" class="mobile-menu-close" data-action="close-mobile-menu" aria-label="Cerrar menú">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        <div class="mobile-menu-body">
          <div>
            <div class="mobile-menu-section-label">Categorías</div>
            <nav id="mobile-menu-categories" class="mobile-menu-list"></nav>
          </div>
          <div>
            <div class="mobile-menu-section-label">Colecciones Destacadas</div>
            <nav id="mobile-menu-collections" class="mobile-menu-list"></nav>
          </div>
          <div class="mobile-menu-footer-links">
            <a href="collection.html?cat=todos" class="mobile-menu-sublink">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
              <span>Ver Todo el Catálogo</span>
            </a>
            <button type="button" class="mobile-menu-sublink" data-action="open-info-modal" style="background:none; border:none; padding:0; cursor:pointer; text-align:left; font-family:inherit;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
              <span>Envíos, Devoluciones y Contacto</span>
            </button>
            <a href="admin/index.html" class="mobile-menu-sublink">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
              <span>Panel de Administración (/admin)</span>
            </a>
          </div>
        </div>
      </aside>
    `;
    document.body.insertAdjacentHTML('beforeend', drawerHtml);
  }

  if (!document.getElementById('mobile-menu-overlay')) {
    const overlay = document.createElement('div');
    overlay.id = 'mobile-menu-overlay';
    overlay.className = 'mobile-menu-overlay';
    overlay.setAttribute('data-action', 'close-mobile-menu');
    document.body.appendChild(overlay);
  }

  // 2. Barra Desplegable de Búsqueda Instantánea
  if (!document.getElementById('search-drawer') && !document.getElementById('search-bar-drawer')) {
    const searchHtml = `
      <div id="search-drawer" class="search-bar-drawer" role="search" aria-label="Buscador instantáneo">
        <div class="search-drawer-inner">
          <div class="search-drawer-input-row">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
            <input type="search" id="global-search-input" class="search-drawer-input" placeholder="Buscar por prenda, corte, color o categoría..." autocomplete="off">
            <button type="button" class="search-drawer-close" data-action="close-search" aria-label="Cerrar buscador">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
          </div>
          <div id="global-search-results" class="search-drawer-results"></div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', searchHtml);
  }

  // 3. Cart Drawer + Overlay
  if (!document.getElementById('cart-drawer')) {
    const cartHtml = `
      <aside id="cart-drawer" class="cart-drawer" role="dialog" aria-modal="true" aria-labelledby="cart-drawer-title">
        <div class="cart-drawer__header">
          <h3 id="cart-drawer-title" class="cart-drawer__title">TU CESTA (<span class="cart-badge-count">0</span>)</h3>
          <button type="button" id="cart-drawer-close" class="sheet-close-btn" data-action="close-cart" aria-label="Cerrar cesta">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
        <div class="cart-shipping-meter" id="cart-shipping-meter">
          <div class="cart-shipping-meter__text">
            <span id="cart-shipping-text">Calculando envío...</span>
            <strong id="cart-shipping-percent">0%</strong>
          </div>
          <div class="cart-shipping-meter__track">
            <div class="cart-shipping-meter__fill" id="cart-shipping-fill" style="width: 0%;"></div>
          </div>
        </div>
        <div id="cart-drawer-items" class="cart-drawer__items"></div>
        <div id="cart-drawer-empty" style="display: none; flex-direction: column; align-items: center; justify-content: center; flex: 1; padding: 2rem; text-align: center; gap: 12px;">
          <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="color: var(--color-text-muted);"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path><line x1="3" y1="6" x2="21" y2="6"></line><path d="M16 10a4 4 0 0 1-8 0"></path></svg>
          <p style="font-size: 14px; font-weight: 500;">Tu cesta está vacía</p>
          <a href="collection.html?cat=todos" class="btn-primary" style="padding: 10px 20px; font-size: 12px; margin-top: 8px;">Explorar Tienda</a>
        </div>
        <div id="cart-drawer-footer" class="cart-drawer__footer" style="display: none;">
          <div class="cart-drawer__subtotal-row">
            <span>Subtotal</span>
            <span id="cart-drawer-subtotal">€0,00</span>
          </div>
          <p id="cart-drawer-shipping-notice" style="font-size: 11px; color: var(--color-text-muted); text-align: center; margin-bottom: 12px;">
            Impuestos incluidos. Envío calculado en el checkout.
          </p>
          <button type="button" id="cart-checkout-btn" class="btn-primary">FINALIZAR COMPRA</button>
        </div>
      </aside>
    `;
    document.body.insertAdjacentHTML('beforeend', cartHtml);
  }

  if (!document.getElementById('cart-drawer-overlay')) {
    const overlay = document.createElement('div');
    overlay.id = 'cart-drawer-overlay';
    overlay.className = 'cart-drawer-overlay';
    overlay.setAttribute('data-action', 'close-cart');
    document.body.appendChild(overlay);
  }

  // 4. Modal Inferior de Información de la Tienda + Overlay
  if (!document.getElementById('store-info-modal')) {
    const infoHtml = `
      <div id="store-info-modal" class="store-info-modal" role="dialog" aria-modal="true" aria-labelledby="store-info-title">
        <div class="store-info-header">
          <h3 id="store-info-title" class="store-info-title" data-setting="store-name">Información de la Tienda</h3>
          <button type="button" class="mobile-menu-close" data-action="close-info-modal" aria-label="Cerrar">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
        <div class="store-info-body">
          <div class="store-info-card">
            <div class="store-info-card__title">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="1" y="3" width="15" height="13"></rect><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon><circle cx="5.5" cy="18.5" r="2.5"></circle><circle cx="18.5" cy="18.5" r="2.5"></circle></svg>
              <span>Envíos 24/48 Horas con Packlink PRO Plus</span>
            </div>
            <p class="store-info-card__desc" id="info-shipping-desc">
              Envíos a toda España peninsular en 24/48h laborables (4,90 € o GRATIS en pedidos superiores a 50,00 €).
            </p>
          </div>

          <div class="store-info-card">
            <div class="store-info-card__title">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect><line x1="1" y1="10" x2="23" y2="10"></line></svg>
              <span>Pagos 100% Seguros</span>
            </div>
            <p class="store-info-card__desc">
              Aceptamos tarjetas de débito/crédito mediante TPV Virtual Redsys (conexión cifrada SHA-256) y Bizum.
            </p>
          </div>

          <div class="store-info-card">
            <div class="store-info-card__title">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><polyline points="23 4 23 10 17 10"></polyline><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>
              <span>Cambios y Devoluciones</span>
            </div>
            <p class="store-info-card__desc" id="info-returns-desc">
              Dispones de 14 días naturales desde la recepción del pedido para solicitar un cambio de talla o devolución.
            </p>
          </div>

          <div class="store-info-card">
            <div class="store-info-card__title">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
              <span>Horario de Atención</span>
            </div>
            <p class="store-info-card__desc" id="info-schedule-desc">
              Lunes a Viernes de 10:00 a 20:00
            </p>
          </div>

          <div class="store-info-card">
            <div class="store-info-card__title">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
              <span>Contacto Directo</span>
            </div>
            <p class="store-info-card__desc" id="info-contact-desc">
              ¿Tienes dudas con tu talla o envío? Escríbenos directamente:
            </p>
            <a href="https://wa.me/34600000000" id="info-whatsapp-btn" target="_blank" rel="noopener" class="store-info-contact-btn">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
              <span>Contactar por WhatsApp</span>
            </a>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', infoHtml);
  }

  if (!document.getElementById('store-info-overlay')) {
    const overlay = document.createElement('div');
    overlay.id = 'store-info-overlay';
    overlay.className = 'store-info-overlay';
    overlay.setAttribute('data-action', 'close-info-modal');
    document.body.appendChild(overlay);
  }

  // 5. Barra de Navegación Fija Inferior (5 Botones)
  if (!document.querySelector('.bottom-tab-bar')) {
    const isHome = window.location.pathname.endsWith('index.html') || window.location.pathname === '/' || window.location.pathname.endsWith('/roneoshop/');
    const isCollection = window.location.pathname.includes('collection.html');
    const isProduct = window.location.pathname.includes('product.html');

    const bottomBarHtml = `
      <nav class="bottom-tab-bar" aria-label="Navegación rápida inferior">
        <button type="button" class="bottom-tab-item ${isHome ? 'is-active' : ''}" data-tab="home" data-nav="home" aria-label="Inicio">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
          <span>Inicio</span>
        </button>
        <button type="button" class="bottom-tab-item" data-tab="search" data-nav="search" aria-label="Buscar">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          <span>Buscar</span>
        </button>
        <button type="button" class="bottom-tab-item" data-tab="cart" data-nav="cart" aria-label="Cesta">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path><line x1="3" y1="6" x2="21" y2="6"></line><path d="M16 10a4 4 0 0 1-8 0"></path></svg>
          <span class="bottom-tab-badge cart-badge-count is-empty">0</span>
          <span>Cesta</span>
        </button>
        <a href="collection.html?cat=todos" class="bottom-tab-item ${(isCollection || isProduct) ? 'is-active' : ''}" data-tab="products" data-nav="products" aria-label="Productos">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="3" width="7" height="7" rx="1"></rect>
            <rect x="14" y="3" width="7" height="7" rx="1"></rect>
            <rect x="14" y="14" width="7" height="7" rx="1"></rect>
            <rect x="3" y="14" width="7" height="7" rx="1"></rect>
          </svg>
          <span>Productos</span>
        </a>
        <button type="button" class="bottom-tab-item" data-tab="info" data-nav="info" aria-label="Info">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
          <span>Info</span>
        </button>
      </nav>
    `;
    document.body.insertAdjacentHTML('beforeend', bottomBarHtml);
  }
}

/**
 * Delegación Global de Eventos Infalible en document
 */
let delegatedListenersInitialized = false;
export function initGlobalNavigationShell() {
  ensureGlobalShellElements();

  if (delegatedListenersInitialized) return;
  delegatedListenersInitialized = true;

  document.addEventListener('click', (e) => {
    // 1. Abrir Menú Hamburger
    if (e.target.closest('#btn-open-menu, #mobile-menu-btn, #header-menu-btn, .header-menu-btn, .hamburger-btn, .header-left button, [data-action="open-menu"]')) {
      e.preventDefault();
      openHamburgerDrawer();
      return;
    }

    // Cerrar Menú Hamburger
    if (e.target.closest('[data-action="close-mobile-menu"], #hamburger-close-btn, #hamburger-close, .hamburger-drawer__close, #mobile-menu-overlay')) {
      e.preventDefault();
      closeHamburgerDrawer();
      return;
    }

    // 2. Botón 1 Home
    if (e.target.closest('[data-tab="home"], [data-nav="home"], #bottom-tab-home')) {
      e.preventDefault();
      closeAllDrawers();
      const isHome = window.location.pathname.endsWith('index.html') || window.location.pathname === '/' || window.location.pathname.endsWith('/roneoshop/');
      if (isHome) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        window.location.href = 'index.html';
      }
      return;
    }

    // 3. Botón 2 Buscar (y Lupa del Header)
    if (e.target.closest('#btn-open-search, #header-search-btn, .header-search-btn, .header-icon-btn[aria-label*="uscar"], [data-tab="search"], [data-nav="search"], #bottom-tab-buscar')) {
      e.preventDefault();
      toggleSearchDrawer();
      return;
    }

    // Cerrar Buscador
    if (e.target.closest('[data-action="close-search"], #search-close-btn, .search-bar-close, .search-drawer-close')) {
      e.preventDefault();
      closeSearchDrawer();
      return;
    }

    // 4. Botón 3 Carro (y Bolsa del Header)
    if (e.target.closest('#btn-open-cart, #header-cart-btn, .header-cart-btn, .js-open-cart-drawer, [data-tab="cart"], [data-nav="cart"], #bottom-tab-carro')) {
      e.preventDefault();
      renderCartDrawer();
      openCartDrawer();
      return;
    }

    // Cerrar Carro
    if (e.target.closest('[data-action="close-cart"], #cart-drawer-close, .sheet-close-btn, #cart-drawer-overlay')) {
      e.preventDefault();
      closeCartDrawer();
      return;
    }

    // Acciones dentro del Carrito (Eliminar, Decrementar, Incrementar, Checkout)
    const removeCartBtn = e.target.closest('[data-action="remove-cart-item"]');
    if (removeCartBtn) {
      e.preventDefault();
      const cartId = removeCartBtn.getAttribute('data-cart-id');
      if (cartId) removeFromCart(cartId);
      return;
    }

    const decCartBtn = e.target.closest('[data-action="dec-cart-qty"]');
    if (decCartBtn) {
      e.preventDefault();
      const cartId = decCartBtn.getAttribute('data-cart-id');
      const cart = getCart();
      const item = cart.find(x => x.cartItemId === cartId);
      if (item) updateCartItemQuantity(cartId, item.quantity - 1);
      return;
    }

    const incCartBtn = e.target.closest('[data-action="inc-cart-qty"]');
    if (incCartBtn) {
      e.preventDefault();
      const cartId = incCartBtn.getAttribute('data-cart-id');
      const cart = getCart();
      const item = cart.find(x => x.cartItemId === cartId);
      if (item) updateCartItemQuantity(cartId, item.quantity + 1);
      return;
    }

    if (e.target.closest('#cart-checkout-btn, .cart-checkout-btn')) {
      e.preventDefault();
      window.location.href = 'checkout.html';
      return;
    }

    // 5. Botón 4 Productos y VER TODO: Navegación obligatoria directa a collection.html?cat=todos
    if (e.target.closest('[data-tab="products"], [data-nav="products"], #bottom-tab-productos, #view-all-btn, .view-all-btn, #btn-explore-footwear, #btn-explore-spring, #btn-see-highlight-products')) {
      e.preventDefault();
      closeAllDrawers();
      const clickedBtn = e.target.closest('#btn-explore-footwear, #btn-explore-spring, #btn-see-highlight-products, #view-all-btn, .view-all-btn, [data-tab="products"], [data-nav="products"], #bottom-tab-productos');
      if (clickedBtn && clickedBtn.id === 'btn-explore-footwear') {
        window.location.href = 'collection.html?cat=calzado';
      } else if (clickedBtn && clickedBtn.id === 'btn-explore-spring') {
        window.location.href = 'collection.html?cat=primavera-verano';
      } else {
        window.location.href = 'collection.html?cat=todos';
      }
      return;
    }

    // 6. Botón 5 Info (y Enlace de Info en Drawer)
    if (e.target.closest('[data-tab="info"], [data-nav="info"], #bottom-tab-info, [data-action="open-info-modal"]')) {
      e.preventDefault();
      openStoreInfoModal();
      return;
    }

    // Cerrar Info Modal
    if (e.target.closest('[data-action="close-info-modal"], #store-info-close, .info-modal-close, #store-info-overlay')) {
      e.preventDefault();
      closeStoreInfoModal();
      return;
    }
  });

  // Configurar input de búsqueda en vivo
  setupLiveSearch();
}

/**
 * Buscador desplegable reactivo en vivo
 */
function setupLiveSearch() {
  const input = document.getElementById('global-search-input') || document.getElementById('search-input');
  if (!input) return;

  input.addEventListener('input', (e) => {
    const q = e.target.value.trim().toLowerCase();
    const resultsContainer = document.getElementById('global-search-results');
    if (!resultsContainer) return;

    if (!q) {
      resultsContainer.innerHTML = '';
      return;
    }

    const matches = allProducts.filter(p => {
      const title = (p.title || p.name || '').toLowerCase();
      const cat = (p.category || '').toLowerCase();
      const desc = (p.description || '').toLowerCase();
      const color = Array.isArray(p.colors) ? p.colors.map(c => c.name.toLowerCase()).join(' ') : '';
      return title.includes(q) || cat.includes(q) || desc.includes(q) || color.includes(q);
    }).slice(0, 5);

    if (matches.length === 0) {
      resultsContainer.innerHTML = `
        <div style="padding: 16px; text-align: center; color: #888; font-size: 13px;">
          No se encontraron prendas para "${escapeHtml(q)}".
        </div>
      `;
      return;
    }

    resultsContainer.innerHTML = `
      ${matches.map(p => `
        <a href="product.html?id=${encodeURIComponent(p.id)}" class="search-result-item">
          <img src="${escapeHtml(p.images?.[0] || '')}" alt="${escapeHtml(p.title)}" class="search-result-thumb" />
          <div class="search-result-info">
            <span class="search-result-title">${escapeHtml(p.title)}</span>
            <span class="search-result-price">${formatPrice(p.price)}</span>
          </div>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="7" y1="17" x2="17" y2="7"></line><polyline points="7 7 17 7 17 17"></polyline></svg>
        </a>
      `).join('')}
      <a href="collection.html?q=${encodeURIComponent(q)}" style="display: block; text-align: center; padding: 10px; font-size: 12px; font-weight: 600; text-transform: uppercase; color: #121212; border-top: 1px solid #eee; margin-top: 6px;">
        Ver todos los resultados &rarr;
      </a>
    `;
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const q = input.value.trim();
      if (q) window.location.href = `collection.html?q=${encodeURIComponent(q)}`;
    }
  });
}

/**
 * Control de Drawers y Modales
 */
export function openHamburgerDrawer() {
  closeAllDrawers();
  const drawer = document.getElementById('mobile-menu-drawer') || document.getElementById('hamburger-menu');
  const overlay = document.getElementById('mobile-menu-overlay') || document.getElementById('sheet-overlay');
  if (drawer) drawer.classList.add('is-open');
  if (overlay) overlay.classList.add('is-open');
  document.body.classList.add('overflow-hidden');
}

export function closeHamburgerDrawer() {
  const drawer = document.getElementById('mobile-menu-drawer') || document.getElementById('hamburger-menu');
  const overlay = document.getElementById('mobile-menu-overlay') || document.getElementById('sheet-overlay');
  if (drawer) drawer.classList.remove('is-open');
  if (overlay) overlay.classList.remove('is-open');
  document.body.classList.remove('overflow-hidden');
}

export function openCartDrawer() {
  closeAllDrawers();
  const drawer = document.getElementById('cart-drawer');
  const overlay = document.getElementById('cart-drawer-overlay') || document.getElementById('sheet-overlay');
  if (drawer) drawer.classList.add('is-open');
  if (overlay) overlay.classList.add('is-open');
  document.body.classList.add('overflow-hidden');
}

export function closeCartDrawer() {
  const drawer = document.getElementById('cart-drawer');
  const overlay = document.getElementById('cart-drawer-overlay') || document.getElementById('sheet-overlay');
  if (drawer) drawer.classList.remove('is-open');
  if (overlay) overlay.classList.remove('is-open');
  document.body.classList.remove('overflow-hidden');
}

export function openSearchDrawer() {
  closeAllDrawers();
  const drawer = document.getElementById('search-drawer') || document.getElementById('search-bar-drawer');
  if (drawer) {
    drawer.classList.add('is-open');
    const input = document.getElementById('global-search-input') || document.getElementById('search-input');
    if (input) setTimeout(() => input.focus(), 80);
  }
}

export function closeSearchDrawer() {
  const drawer = document.getElementById('search-drawer') || document.getElementById('search-bar-drawer');
  if (drawer) drawer.classList.remove('is-open');
}

export function toggleSearchDrawer() {
  const drawer = document.getElementById('search-drawer') || document.getElementById('search-bar-drawer');
  if (drawer && drawer.classList.contains('is-open')) {
    closeSearchDrawer();
  } else {
    openSearchDrawer();
  }
}

export function openStoreInfoModal() {
  closeAllDrawers();
  const modal = document.getElementById('store-info-modal');
  const overlay = document.getElementById('store-info-overlay') || document.getElementById('sheet-overlay');
  if (modal) modal.classList.add('is-open');
  if (overlay) overlay.classList.add('is-open');
  document.body.classList.add('overflow-hidden');
}

export function closeStoreInfoModal() {
  const modal = document.getElementById('store-info-modal');
  const overlay = document.getElementById('store-info-overlay') || document.getElementById('sheet-overlay');
  if (modal) modal.classList.remove('is-open');
  if (overlay) overlay.classList.remove('is-open');
  document.body.classList.remove('overflow-hidden');
}

export function closeAllDrawers() {
  closeHamburgerDrawer();
  closeCartDrawer();
  closeSearchDrawer();
  closeStoreInfoModal();
  closeQuickAddSheet();
}

/**
 * --------------------------------------------------------------------------
 * APLICACIÓN EN VIVO DE AJUSTES EN EL ESCAPARATE (store.subscribeSettings)
 * --------------------------------------------------------------------------
 */
export function applySettingsToDOM(settings) {
  if (!settings) return;
  currentSettings = settings;

  // 1. Nombre de la Tienda
  if (settings.storeName) {
    document.querySelectorAll('[data-setting="store-name"]').forEach(el => {
      el.textContent = settings.storeName;
    });
    // Proteger el logotipo oficial en imagen y actualizar alt o texto de respaldo
    document.querySelectorAll('.header-logo').forEach(el => {
      const logoImg = el.querySelector('.header-logo__img');
      if (logoImg) {
        logoImg.alt = settings.storeName || 'Roneo Shop';
      } else {
        const sym = el.querySelector('.header-logo__symbol');
        el.innerHTML = '';
        if (sym) el.appendChild(sym);
        el.append(` ${settings.storeName || 'Roneo Shop'}`);
      }
    });
    if (!document.title.includes(settings.storeName)) {
      document.title = `${document.title.split('|')[0].trim()} | ${settings.storeName}`;
    }
  }

  // 2. Barra Superior de Anuncio Marquee
  if (settings.announcementText) {
    renderAnnouncementMarquee(settings.announcementText);
  }

  // 3. Hero Editorial de Portada
  const heroTitle = document.querySelector('.editorial-hero__title');
  if (heroTitle && settings.heroTitle) heroTitle.textContent = settings.heroTitle;

  const heroDesc = document.querySelector('.editorial-hero__desc');
  if (heroDesc && settings.heroSubtitle) heroDesc.textContent = settings.heroSubtitle;

  const heroImg = document.querySelector('.editorial-hero__media img');
  if (heroImg && settings.heroImage) heroImg.src = settings.heroImage;

  // 4. Modal de Info de la Tienda
  const shipDesc = document.getElementById('info-shipping-desc');
  if (shipDesc) {
    const shipPrice = formatPrice(settings.shippingStandardPrice || 4.90);
    const freeThresh = formatPrice(settings.freeShippingThreshold || 50.00);
    shipDesc.textContent = `Envíos a toda España peninsular en 24/48h laborables (${shipPrice} o GRATIS en pedidos superiores a ${freeThresh}).`;
  }

  const retDesc = document.getElementById('info-returns-desc');
  if (retDesc && settings.returnPolicySummary) {
    retDesc.textContent = settings.returnPolicySummary;
  }

  const schDesc = document.getElementById('info-schedule-desc');
  if (schDesc && settings.storeSchedule) {
    schDesc.textContent = settings.storeSchedule;
  }

  const waBtn = document.getElementById('info-whatsapp-btn');
  if (waBtn && settings.contactPhone) {
    const cleanPhone = String(settings.contactPhone).replace(/[^0-9]/g, '');
    waBtn.href = `https://wa.me/${cleanPhone.startsWith('34') ? cleanPhone : '34' + cleanPhone}`;
  }

  // 5. Carrusel dinámico de Colecciones en Portada
  if (Array.isArray(settings.collections)) {
    renderCollectionsCarousel(settings.collections);
  }

  // 6. Listas dinámicas del Menú Hamburger
  renderHamburgerMenu(settings);

  // 7. Pestañas de categorías
  if (Array.isArray(settings.categories)) {
    renderCategoryTabs(settings.categories);
  }
}

/**
 * Renderiza el Carrusel de Colecciones en Portada desde settings.collections
 */
export function renderCollectionsCarousel(collections) {
  const container = document.getElementById('collections-carousel') || document.querySelector('.collections-carousel');
  if (!container) return;

  const list = Array.isArray(collections) && collections.length > 0
    ? collections.filter(c => c.active !== false)
    : DEFAULT_COLLECTIONS;

  container.innerHTML = list.map(col => {
    const slug = (col.slug || col.id || '').toLowerCase();
    const title = (col.title || '').toUpperCase();
    const subtitle = col.subtitle || 'Colección';
    const image = col.image || 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=800&q=82';

    return `
      <a href="collection.html?cat=${encodeURIComponent(slug)}" class="collection-card js-collection-filter" data-category="${escapeHtml(slug)}" aria-label="Colección ${escapeHtml(title)}">
        <div class="collection-card__media">
          <img src="${escapeHtml(image)}" alt="${escapeHtml(title)}" loading="lazy" />
        </div>
        <div class="collection-card__footer">
          <div>
            <div class="collection-card__title">${escapeHtml(title)}</div>
            <div class="collection-card__count">${escapeHtml(subtitle)}</div>
          </div>
          <div class="collection-card__arrow">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="7" y1="17" x2="17" y2="7"></line><polyline points="7 7 17 7 17 17"></polyline></svg>
          </div>
        </div>
      </a>
    `;
  }).join('');
}

/**
 * Renderiza el menú Hamburger dinámico conectado a store.settings
 */
export function renderHamburgerMenu(settings) {
  const catsContainer = document.getElementById('mobile-menu-categories') || document.querySelector('.hamburger-drawer__nav');
  if (catsContainer) {
    const cats = Array.isArray(settings?.categories) && settings.categories.length > 0
      ? settings.categories.filter(c => !['cabello', 'cosmetica', 'peikas'].includes(c.id || c.slug))
      : DEFAULT_CATEGORIES;

    catsContainer.innerHTML = cats.map(cat => {
      const slug = (cat.slug || cat.id || '').toLowerCase();
      const name = (cat.name || '').toUpperCase();
      const isSale = slug.includes('rebaja') || slug === 'sale';
      return `
        <a href="collection.html?cat=${encodeURIComponent(slug)}" class="mobile-menu-link ${isSale ? 'is-sale' : ''}" data-category="${escapeHtml(slug)}">
          <span>${escapeHtml(name)}</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
        </a>
      `;
    }).join('');
  }

  const colsContainer = document.getElementById('mobile-menu-collections');
  if (colsContainer) {
    const cols = Array.isArray(settings?.collections) && settings.collections.length > 0
      ? settings.collections.filter(c => c.active !== false)
      : DEFAULT_COLLECTIONS;

    colsContainer.innerHTML = cols.map(col => {
      const slug = (col.slug || col.id || '').toLowerCase();
      const title = (col.title || '').toUpperCase();
      return `
        <a href="collection.html?cat=${encodeURIComponent(slug)}" class="mobile-menu-link" data-category="${escapeHtml(slug)}">
          <span>${escapeHtml(title)}</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
        </a>
      `;
    }).join('');
  }
}

export function renderAnnouncementMarquee(rawText) {
  const cleanText = (rawText || "NUEVA COLECCIÓN 2026 OTOÑO & INVIERNO · ENVÍO GRATIS A PARTIR DE 50€").trim();
  const bars = document.querySelectorAll('.announcement-bar');
  bars.forEach((bar) => {
    // Construimos dos pistas idénticas con 6 repeticiones cada una para un loop infinito 100% continuo sin saltos
    const itemsHtml = Array.from({ length: 6 })
      .map(() => `<span class="announcement-bar__item">${cleanText}</span>`)
      .join('');
    bar.innerHTML = `
      <div class="announcement-bar__viewport">
        <div class="announcement-bar__track">
          <div class="announcement-bar__group">${itemsHtml}</div>
          <div class="announcement-bar__group" aria-hidden="true">${itemsHtml}</div>
        </div>
      </div>
    `;
  });
}

export function setupAnnouncement(text) {
  renderAnnouncementMarquee(text);
}

/**
 * Renderiza las pestañas Serif dinámicamente desde settings.categories
 */
export function renderCategoryTabs(categories) {
  const container = document.getElementById('category-tabs');
  if (!container) return;

  const rawList = Array.isArray(categories) && categories.length > 0
    ? categories
    : DEFAULT_CATEGORIES;

  const list = rawList.filter(c => !['cabello', 'cosmetica', 'peikas'].includes(c.id || c.slug));

  container.innerHTML = list.map(cat => {
    const slug = (cat.slug || cat.id || cat).toLowerCase();
    const name = (cat.name || cat).toUpperCase();
    const isActive = slug === activeCategory.toLowerCase();
    return `
      <button 
        type="button" 
        class="category-tab ${isActive ? 'is-active' : ''}" 
        data-category="${slug}">
        ${name}
      </button>
    `;
  }).join('');

  container.querySelectorAll('.category-tab').forEach(tab => {
    tab.addEventListener('click', (e) => {
      setCategory(e.currentTarget.dataset.category.toLowerCase());
    });
  });
}

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
    if (section) section.scrollIntoView({ behavior: 'smooth' });
  }
}

/**
 * Renderiza los productos o la tarjeta editorial elegante de "Próximamente"
 */
export function renderProducts() {
  const track = document.getElementById('products-track');
  if (!track) return;

  let filtered = [...allProducts];

  if (searchQuery.trim() !== '') {
    const q = searchQuery.toLowerCase().trim();
    filtered = filtered.filter(p => 
      p.title.toLowerCase().includes(q) || 
      p.category.toLowerCase().includes(q) ||
      (p.description && p.description.toLowerCase().includes(q))
    );
  } else if (activeCategory !== 'todos') {
    filtered = filtered.filter(p => (p.category || '').toLowerCase() === activeCategory);
  }

  if (isGridMode) {
    track.className = 'products-track--grid';
  } else {
    track.className = 'products-track--carousel';
  }

  if (filtered.length === 0) {
    const catName = activeCategory === 'mas-proximamente' 
      ? 'Más Colecciones' 
      : activeCategory.toUpperCase();

    track.innerHTML = `
      <div class="editorial-coming-soon-card" style="grid-column: 1 / -1; width: 100%; min-width: 280px; padding: 48px 24px; text-align: center; background: #fafafa; border-radius: 12px; border: 1px dashed #e0e0e0; margin: 12px 0;">
        <span style="font-size: 11px; letter-spacing: 0.15em; text-transform: uppercase; color: var(--color-text-muted); font-weight: 600;">LÍNEA EN PREPARACIÓN</span>
        <h3 style="font-family: var(--font-serif); font-size: 28px; font-weight: 400; margin: 10px 0 8px 0; color: #121212;">${catName} · Próximamente</h3>
        <p style="font-size: 13px; color: var(--color-text-muted); max-width: 420px; margin: 0 auto 18px auto; line-height: 1.5;">
          Estamos confeccionando los nuevos diseños exclusivos para esta sección. Disponibles muy pronto en nuestro catálogo oficial.
        </p>
        <button type="button" class="btn-editorial" id="btn-empty-cat-ropa" style="padding: 10px 24px; font-size: 12px; letter-spacing: 0.08em; display: inline-block;">
          EXPLORAR ROPA
        </button>
      </div>
    `;

    const resetBtn = document.getElementById('btn-empty-cat-ropa');
    resetBtn?.addEventListener('click', () => setCategory('ropa', true));
    return;
  }

  track.innerHTML = filtered.map(product => renderProductCardMarkup(product)).join('');
  bindProductCardEvents(track, allProducts);
}

/**
 * Renderiza el Grid de 2 productos destacados en portada
 */
export function renderDuoProducts() {
  const container = document.getElementById('duo-products-container');
  if (!container) return;

  const p1 = allProducts.find(p => p.id === 'botin-chelsea-piel-negro') || allProducts[0];
  const p2 = allProducts.find(p => p.id === 'abrigo-pandora') || allProducts[1];

  const duoList = [p1, p2].filter(Boolean);
  container.innerHTML = duoList.map(product => renderProductCardMarkup(product)).join('');
  bindProductCardEvents(container, allProducts);
}

/**
 * Bottom-Sheet Quick Add
 */
export function openQuickAddSheet(product) {
  modalProduct = product;

  const colors = Array.isArray(product.colors) ? product.colors : [];
  if (colors.length > 0) {
    const inStockColor = colors.find(c => (c.sizes || []).some(s => s.stock > 0));
    modalSelectedColor = inStockColor || colors[0];
  } else {
    modalSelectedColor = null;
  }

  const colorSizes = modalSelectedColor?.sizes || product.variants || [];
  if (product.hasSizes !== false && colorSizes.length > 0) {
    const inStockSize = colorSizes.find(s => s.stock > 0);
    modalSelectedSize = inStockSize ? inStockSize.size : colorSizes[0].size;
  } else {
    modalSelectedSize = 'ÚNICA';
  }

  renderQuickAddSheet();

  const sheet = document.getElementById('quick-add-sheet');
  const overlay = document.getElementById('sheet-overlay');
  if (sheet) sheet.classList.add('is-open');
  if (overlay) overlay.classList.add('is-open');
  document.body.classList.add('overflow-hidden');
}

export function closeQuickAddSheet() {
  const sheet = document.getElementById('quick-add-sheet');
  const overlay = document.getElementById('sheet-overlay');
  if (sheet) sheet.classList.remove('is-open');
  if (overlay && !document.querySelector('.cart-drawer.is-open')) {
    overlay.classList.remove('is-open');
  }
  document.body.classList.remove('overflow-hidden');
  modalProduct = null;
}

function renderQuickAddSheet() {
  if (!modalProduct) return;

  const mediaEl = document.getElementById('modal-sheet-img');
  const titleEl = document.getElementById('modal-sheet-title');
  const priceEl = document.getElementById('modal-sheet-price');
  const compareEl = document.getElementById('modal-sheet-compare');
  const colorsSection = document.getElementById('modal-color-section');
  const colorsContainer = document.getElementById('modal-colors-container');
  const sizesSection = document.getElementById('modal-sizes-section');
  const sizesContainer = document.getElementById('modal-sizes-container');
  const addBtn = document.getElementById('modal-btn-add');

  const mainPhoto = (modalSelectedColor && modalSelectedColor.photos?.[0]) 
    ? modalSelectedColor.photos[0]
    : (modalProduct.images?.[0] || '');

  if (mediaEl) mediaEl.src = mainPhoto;
  if (titleEl) titleEl.textContent = modalProduct.title;
  if (priceEl) priceEl.textContent = formatPrice(modalProduct.price);

  if (compareEl) {
    if (modalProduct.compareAtPrice && modalProduct.compareAtPrice > modalProduct.price) {
      compareEl.textContent = formatPrice(modalProduct.compareAtPrice);
      compareEl.style.display = 'inline';
    } else {
      compareEl.style.display = 'none';
    }
  }

  // Renderizar Selector de Color
  const colors = Array.isArray(modalProduct.colors) ? modalProduct.colors : [];
  if (colors.length > 1 && colorsSection && colorsContainer) {
    colorsSection.style.display = 'block';
    colorsContainer.innerHTML = colors.map(col => {
      const isSelected = modalSelectedColor && modalSelectedColor.name === col.name;
      const totalColStock = (col.sizes || []).reduce((sum, s) => sum + s.stock, 0);
      const isColSoldOut = totalColStock <= 0;

      return `
        <button 
          type="button" 
          class="color-pill ${isSelected ? 'is-selected' : ''} ${isColSoldOut ? 'is-soldout' : ''}" 
          data-color="${escapeHtml(col.name)}">
          <span class="color-pill__dot" style="background-color: ${escapeHtml(col.hex || '#121212')};"></span>
          <span>${escapeHtml(col.name)}</span>
        </button>
      `;
    }).join('');

    colorsContainer.querySelectorAll('.color-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        const cName = btn.dataset.color;
        const found = colors.find(c => c.name === cName);
        if (found) {
          modalSelectedColor = found;
          const sizes = found.sizes || [];
          const inStock = sizes.find(s => s.stock > 0);
          modalSelectedSize = inStock ? inStock.size : (sizes[0]?.size || 'ÚNICA');
          renderQuickAddSheet();
        }
      });
    });
  } else if (colorsSection) {
    colorsSection.style.display = 'none';
  }

  // Renderizar Selector de Tallas
  const sizes = (modalSelectedColor && Array.isArray(modalSelectedColor.sizes))
    ? modalSelectedColor.sizes
    : (Array.isArray(modalProduct.variants) ? modalProduct.variants : []);

  if (modalProduct.hasSizes !== false && sizes.length > 0 && sizesSection && sizesContainer) {
    sizesSection.style.display = 'block';
    sizesContainer.innerHTML = sizes.map(sz => {
      const isSelected = modalSelectedSize === sz.size;
      const isSoldOut = sz.stock <= 0;
      return `
        <button 
          type="button" 
          class="size-pill ${isSelected ? 'is-selected' : ''} ${isSoldOut ? 'is-soldout' : ''}" 
          data-size="${escapeHtml(sz.size)}" 
          ${isSoldOut ? 'disabled' : ''}>
          ${escapeHtml(sz.size)}
        </button>
      `;
    }).join('');

    sizesContainer.querySelectorAll('.size-pill:not(.is-soldout)').forEach(btn => {
      btn.addEventListener('click', () => {
        modalSelectedSize = btn.dataset.size;
        renderQuickAddSheet();
      });
    });
  } else if (sizesSection) {
    sizesSection.style.display = 'none';
  }

  // Comprobar disponibilidad final
  if (addBtn) {
    let currentStock = 0;
    if (modalProduct.hasSizes === false) {
      currentStock = modalProduct.totalStock || 1;
    } else {
      const selectedSizeObj = sizes.find(s => s.size === modalSelectedSize);
      currentStock = selectedSizeObj ? selectedSizeObj.stock : 0;
    }

    if (currentStock <= 0) {
      addBtn.textContent = 'Agotado';
      addBtn.disabled = true;
    } else {
      addBtn.textContent = 'Añadir a la cesta';
      addBtn.disabled = false;
    }
  }
}

/**
 * Renderizado del Cart Drawer con Estructura Horizontal Compacta y Barra Dinámica
 */
export function renderCartDrawer() {
  const cart = getCart();
  const totalUnits = cart.reduce((acc, item) => acc + (parseInt(item.quantity, 10) || 1), 0);
  const threshold = Number(currentSettings?.freeShippingThreshold ?? 50.00);
  const shipPrice = Number(currentSettings?.shippingStandardPrice ?? 4.90);
  const totals = getCartTotals(threshold, shipPrice);

  // 1. Sincronización exacta del título del Drawer
  const drawerTitle = document.getElementById('cart-drawer-title') || document.querySelector('.cart-drawer__title');
  if (drawerTitle) {
    drawerTitle.textContent = `TU CESTA (${totalUnits})`;
  }

  // 2. Barra dinámica de Envío Gratis
  const shippingTextEl = document.getElementById('cart-shipping-text');
  const shippingPercentEl = document.getElementById('cart-shipping-percent');
  const progressFillEl = document.getElementById('cart-shipping-fill');

  if (shippingTextEl && progressFillEl) {
    if (totals.subtotal >= threshold) {
      shippingTextEl.textContent = '¡Enhorabuena! Tienes ENVÍO GRATIS en tu pedido';
      progressFillEl.style.width = '100%';
      if (shippingPercentEl) shippingPercentEl.textContent = '100%';
    } else {
      const remaining = (threshold - totals.subtotal).toFixed(2).replace('.', ',');
      const pct = Math.min(100, (totals.subtotal / threshold) * 100);
      shippingTextEl.textContent = `Te faltan €${remaining} para disfrutar de ENVÍO GRATIS`;
      progressFillEl.style.width = `${pct}%`;
      if (shippingPercentEl) shippingPercentEl.textContent = `${Math.round(pct)}%`;
    }
  }

  const itemsContainer = document.getElementById('cart-drawer-items') || document.getElementById('cart-items-list') || document.querySelector('.cart-drawer__items');
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

    const subtotalValEl = document.getElementById('cart-drawer-subtotal');
    if (subtotalValEl) subtotalValEl.textContent = `€${totals.subtotal.toFixed(2).replace('.', ',')}`;

    const shipNotice = document.getElementById('cart-drawer-shipping-notice');
    if (shipNotice) {
      shipNotice.textContent = totals.hasFreeShipping 
        ? '¡Envío Gratuito incluido!' 
        : `Coste de envío: €${shipPrice.toFixed(2).replace('.', ',')} (GRATIS desde €${threshold.toFixed(2).replace('.', ',')}).`;
    }

    if (itemsContainer) {
      itemsContainer.innerHTML = cart.map(item => `
        <div class="cart-drawer-item" data-cart-id="${escapeHtml(item.cartItemId)}">
          <a href="product.html?id=${encodeURIComponent(item.productId)}" class="cart-drawer-item__media">
            <img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.title)}" class="cart-drawer-item__img" loading="lazy">
          </a>
          <div class="cart-drawer-item__info">
            <div class="cart-drawer-item__top">
              <a href="product.html?id=${encodeURIComponent(item.productId)}" class="cart-drawer-item__title">${escapeHtml(item.title)}</a>
              <button type="button" class="cart-drawer-item__remove" data-action="remove-cart-item" data-cart-id="${escapeHtml(item.cartItemId)}" aria-label="Eliminar artículo">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
              </button>
            </div>
            <div class="cart-drawer-item__meta">
              ${item.color ? `<span class="cart-meta-tag"><span class="cart-color-dot" style="background:${escapeHtml(item.colorHex || '#121212')}"></span>${escapeHtml(item.color)}</span>` : ''}
              ${item.size && item.size !== 'ÚNICA' ? `<span class="cart-meta-tag">Talla: <strong>${escapeHtml(item.size)}</strong></span>` : ''}
            </div>
            <div class="cart-drawer-item__bottom">
              <div class="cart-qty-control">
                <button type="button" class="cart-qty-btn" data-action="dec-cart-qty" data-cart-id="${escapeHtml(item.cartItemId)}" aria-label="Restar uno">&minus;</button>
                <span class="cart-qty-value">${item.quantity}</span>
                <button type="button" class="cart-qty-btn" data-action="inc-cart-qty" data-cart-id="${escapeHtml(item.cartItemId)}" aria-label="Sumar uno" ${item.quantity >= item.maxStock ? 'disabled' : ''}>&plus;</button>
              </div>
              <div class="cart-drawer-item__price">
                €${(Number(item.price) * Number(item.quantity)).toFixed(2).replace('.', ',')}
              </div>
            </div>
          </div>
        </div>
      `).join('');

      // Enlaces de eventos directos complementarios
      itemsContainer.querySelectorAll('[data-action="dec-cart-qty"]').forEach(btn => {
        btn.addEventListener('click', () => {
          const cId = btn.getAttribute('data-cart-id');
          const it = cart.find(x => x.cartItemId === cId);
          if (it) updateCartItemQuantity(cId, it.quantity - 1);
        });
      });

      itemsContainer.querySelectorAll('[data-action="inc-cart-qty"]').forEach(btn => {
        btn.addEventListener('click', () => {
          const cId = btn.getAttribute('data-cart-id');
          const it = cart.find(x => x.cartItemId === cId);
          if (it) updateCartItemQuantity(cId, it.quantity + 1);
        });
      });

      itemsContainer.querySelectorAll('[data-action="remove-cart-item"]').forEach(btn => {
        btn.addEventListener('click', () => {
          removeFromCart(btn.getAttribute('data-cart-id'));
        });
      });
    }
  }

  updateCartBadges();
}

export function updateCartBadges() {
  const cart = getCart();
  const totalUnits = cart.reduce((acc, item) => acc + (parseInt(item.quantity, 10) || 1), 0);

  // Sincronizar título de cesta
  const drawerTitle = document.getElementById('cart-drawer-title') || document.querySelector('.cart-drawer__title');
  if (drawerTitle) {
    drawerTitle.textContent = `TU CESTA (${totalUnits})`;
  }

  // Sincronizar badges
  document.querySelectorAll('.cart-badge-count, .cart-count-badge, #header-cart-badge, #bottom-tab-badge').forEach(badge => {
    badge.textContent = totalUnits;
    if (totalUnits > 0) {
      badge.classList.remove('is-empty');
      badge.style.display = 'inline-flex';
    } else {
      badge.classList.add('is-empty');
      badge.style.display = 'none';
    }
  });
}

/**
 * Configuración global de eventos y modales de la web
 */
export function setupCommonUI() {
  initGlobalNavigationShell();
  renderAnnouncementMarquee();

  // Listeners de actualización de carrito
  window.addEventListener('cart:updated', (e) => {
    renderCartDrawer();
    updateCartBadges();
    if (e.detail?.openDrawer) {
      openCartDrawer();
    }
  });

  // Toggle Carrusel / Grid en portada
  const toggleViewBtn = document.getElementById('toggle-view-btn');
  if (toggleViewBtn) {
    toggleViewBtn.addEventListener('click', () => {
      isGridMode = !isGridMode;
      renderProducts();
    });
  }

  // Búsqueda en portada
  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value;
      renderProducts();
    });
  }

  // Botón "Ver Todo"
  const viewAllBtn = document.getElementById('view-all-btn');
  if (viewAllBtn) {
    viewAllBtn.addEventListener('click', () => {
      window.location.href = `collection.html?cat=${encodeURIComponent(activeCategory || 'ropa')}`;
    });
  }

  // Botones editoriales
  document.getElementById('btn-explore-autumn')?.addEventListener('click', () => {
    window.location.href = 'collection.html?cat=otono-invierno';
  });

  document.getElementById('btn-explore-spring')?.addEventListener('click', () => {
    window.location.href = 'collection.html?cat=primavera-verano';
  });

  document.getElementById('btn-explore-footwear')?.addEventListener('click', () => {
    window.location.href = 'collection.html?cat=calzado';
  });

  document.getElementById('btn-see-highlight-products')?.addEventListener('click', () => {
    window.location.href = 'collection.html?cat=ropa';
  });

  // Botón Checkout
  document.getElementById('cart-checkout-btn')?.addEventListener('click', () => {
    window.location.href = 'checkout.html';
  });

  // Botón "Añadir a la cesta" en Quick Add
  const modalAddBtn = document.getElementById('modal-btn-add');
  if (modalAddBtn) {
    modalAddBtn.addEventListener('click', () => {
      if (!modalProduct) return;
      const sizeToAdd = (modalProduct.hasSizes === false) ? 'ÚNICA' : modalSelectedSize;
      const colorToAdd = modalSelectedColor ? modalSelectedColor.name : 'Color Único';
      const colorHexToAdd = modalSelectedColor ? modalSelectedColor.hex : '#121212';

      const success = addToCart(modalProduct, sizeToAdd, 1, colorToAdd, colorHexToAdd);
      if (success) {
        closeQuickAddSheet();
        openCartDrawer();
      }
    });
  }
}

/**
 * Inicialización reactiva de UI para todas las páginas
 */
document.addEventListener('DOMContentLoaded', async () => {
  try {
    initGlobalNavigationShell();
    setupCommonUI();
    renderCartDrawer();
    updateCartBadges();

    const isHome = !!document.getElementById('products-track');

    // 1. Suscripción en vivo a productos
    unsubscribeProducts = subscribeToProducts((products) => {
      allProducts = products;
      if (isHome) {
        renderProducts();
        renderDuoProducts();
      }
      renderCartDrawer();
      updateCartBadges();
    });

    // 2. Suscripción en vivo a ajustes de tienda
    unsubscribeSettings = subscribeToSettings((settings) => {
      applySettingsToDOM(settings);
      renderCartDrawer();
      updateCartBadges();
    });

  } catch (err) {
    console.error("[UI] Error durante la inicialización:", err);
  }
});

window.addEventListener('beforeunload', () => {
  if (typeof unsubscribeProducts === 'function') unsubscribeProducts();
  if (typeof unsubscribeSettings === 'function') unsubscribeSettings();
});
