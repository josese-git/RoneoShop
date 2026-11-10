/**
 * UI CONTROLLER - RONEO SHOP (FASE 8.1 DEFINITIVA)
 * Control de navegación global (Barra inferior móvil 5 botones, Header desktop 5 botones),
 * Modales editoriales "Sobre mí" y "Mi cuenta", Cart Drawer lateral, Quick Add,
 * Renderizado de Secciones de Portada y Novedades con tarjeta oficial (aspect 4:5, badge olive).
 * Cero Rosa · 100% Blanco Puro (#ffffff) + #4d2525.
 */

import {
  getStoreSettings,
  getProducts,
  subscribeToProducts,
  subscribeToSettings,
  computeProductsFingerprint,
  DEFAULT_CATEGORIES,
  DEFAULT_COLLECTIONS
} from './store-service.js';
import {
  getCart,
  addToCart,
  updateCartItemQuantity,
  removeFromCart,
  getCartTotals
} from './cart.js';

/**
 * Formateador oficial de precios: "35,00 €"
 */
export const formatEuroPrice = (amount) => {
  const num = Number(amount || 0);
  return num.toFixed(2).replace('.', ',') + ' €';
};
export const formatPrice = formatEuroPrice;

/**
 * Limpiador y formateador de títulos a estilo editorial
 * "ABRIGO PANDORA CAMEL" -> "Abrigo Pandora Camel"
 */
export function formatCleanTitle(title) {
  if (!title) return '';
  const trimmed = String(title).trim();
  // Si ya tiene mezcla de mayúsculas y minúsculas naturales
  if (/[a-z]/.test(trimmed) && /[A-Z]/.test(trimmed)) {
    return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
  }
  // Si viene todo en mayúsculas o todo en minúsculas
  return trimmed.toLowerCase().replace(/(?:^|\s|-)\S/g, char => char.toUpperCase());
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

// Estado global de la interfaz
let currentSettings = null;
let allProducts = [];
let activeCategory = 'ropa';
let searchQuery = '';

// Estado del Quick Add
let modalProduct = null;
let modalSelectedColor = null;
let modalSelectedSize = null;

// Suscripciones en vivo
let unsubscribeProducts = null;
let unsubscribeSettings = null;

/**
 * Markup oficial de la tarjeta de producto de Roneo Shop
 */
export function renderProductCardMarkup(product, index = 0) {
  const totalStock = product.totalStock ?? (product.variants ? product.variants.reduce((sum, v) => sum + v.stock, 0) : 0);
  const isSoldOut = totalStock <= 0;
  const hasDiscount = product.compareAtPrice && product.compareAtPrice > product.price;
  const discountPercent = hasDiscount
    ? Math.round(((product.compareAtPrice - product.price) / product.compareAtPrice) * 100)
    : 0;

  const primaryImg = product.images?.[0] || 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=600&q=80';
  const productUrl = `product.html?id=${encodeURIComponent(product.id)}`;

  // Formato de tallas: si es talla única o lista de tallas
  let sizesHtml = '<span>Única</span>';
  if (Array.isArray(product.variants) && product.variants.length > 0) {
    const isOnlyUnica = product.variants.length === 1 && (/^(única|unica|u)$/i.test(product.variants[0].size));
    if (!isOnlyUnica) {
      sizesHtml = product.variants.map(v => {
        return v.stock <= 0 ? `<s>${escapeHtml(v.size)}</s>` : `<span>${escapeHtml(v.size)}</span>`;
      }).join(' ');
    }
  }

  let badgeHtml = '';
  if (isSoldOut) {
    badgeHtml = '<span class="product-card__badge product-card__badge--soldout">AGOTADO</span>';
  } else if (hasDiscount && discountPercent > 0) {
    badgeHtml = `<span class="product-card__badge product-card__badge--discount">-${discountPercent}%</span>`;
  } else {
    badgeHtml = '<span class="product-card__badge product-card__badge--new">NUEVO</span>';
  }

  const motionDelay = Math.min((index % 8) * 60, 480);

  return `
    <article class="product-card js-product-card" data-product-id="${escapeHtml(product.id)}" data-id="${escapeHtml(product.id)}" data-motion="fade-up" style="--motion-delay: ${motionDelay}ms;">
      <a href="${productUrl}" class="product-card__link">
        <div class="product-card__media" data-fx="curtain">
          <img src="${escapeHtml(primaryImg)}" alt="${escapeHtml(product.title)}" class="product-card__img" loading="lazy">
          <div class="fx-curtain" aria-hidden="true"></div>
          ${badgeHtml}
        </div>
        <div class="product-card__body">
          <h3 class="product-card__title">${escapeHtml(formatCleanTitle(product.title))}</h3>
          <div class="product-card__price">
            <span class="product-card__price-current">${formatEuroPrice(product.price)}</span>
            ${hasDiscount ? `<span class="product-card__price-old">${formatEuroPrice(product.compareAtPrice)}</span>` : ''}
          </div>
          <div class="product-card__sizes">
            ${sizesHtml}
          </div>
        </div>
      </a>
    </article>
  `;
}

/**
 * Listeners para tarjetas de producto
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
}

/**
 * Modal "Sobre mí" / "Info"
 */
export function openAboutModal() {
  const modal = document.getElementById('about-modal') || document.getElementById('info-modal') || document.getElementById('store-info-modal');
  if (modal) {
    modal.classList.add('is-open');
    document.body.classList.add('overflow-hidden');
  }
}

export function closeAboutModal() {
  const modal = document.getElementById('about-modal') || document.getElementById('info-modal') || document.getElementById('store-info-modal');
  if (modal) {
    modal.classList.remove('is-open');
    document.body.classList.remove('overflow-hidden');
  }
}

/**
 * Modal "Mi Cuenta"
 */
export function openAccountModal() {
  const modal = document.getElementById('account-preview-modal');
  if (modal) {
    modal.classList.add('is-open');
    document.body.classList.add('overflow-hidden');
  }
}

export function closeAccountModal() {
  const modal = document.getElementById('account-preview-modal');
  if (modal) {
    modal.classList.remove('is-open');
    document.body.classList.remove('overflow-hidden');
  }
}

/**
 * Menú Hamburguesa
 */
export function openHamburgerDrawer() {
  const drawer = document.getElementById('hamburger-menu') || document.getElementById('mobile-menu-drawer');
  const overlay = document.getElementById('sheet-overlay') || document.getElementById('mobile-menu-overlay');
  if (drawer) drawer.classList.add('is-open');
  if (overlay) overlay.classList.add('is-open');
  document.body.classList.add('overflow-hidden');
}

export function closeHamburgerDrawer() {
  const drawer = document.getElementById('hamburger-menu') || document.getElementById('mobile-menu-drawer');
  const overlay = document.getElementById('sheet-overlay') || document.getElementById('mobile-menu-overlay');
  if (drawer) drawer.classList.remove('is-open');
  if (overlay) overlay.classList.remove('is-open');
  document.body.classList.remove('overflow-hidden');
}

/**
 * Buscador desplegable
 */
export function toggleSearchDrawer() {
  const drawer = document.getElementById('search-bar-drawer') || document.getElementById('search-drawer');
  if (!drawer) return;
  const isOpen = drawer.classList.contains('is-open');
  if (isOpen) {
    closeSearchDrawer();
  } else {
    openSearchDrawer();
  }
}

export function openSearchDrawer() {
  const drawer = document.getElementById('search-bar-drawer') || document.getElementById('search-drawer');
  if (!drawer) return;
  drawer.classList.add('is-open');
  const input = drawer.querySelector('input');
  if (input) {
    setTimeout(() => input.focus(), 150);
  }
}

export function closeSearchDrawer() {
  const drawer = document.getElementById('search-bar-drawer') || document.getElementById('search-drawer');
  if (drawer) drawer.classList.remove('is-open');
}

/**
 * Carrito Lateral
 */
export function openCartDrawer() {
  const drawer = document.getElementById('cart-drawer');
  const overlay = document.getElementById('sheet-overlay') || document.getElementById('cart-drawer-overlay');
  if (drawer) drawer.classList.add('is-open');
  if (overlay) overlay.classList.add('is-open');
  document.body.classList.add('overflow-hidden');
}

export function closeCartDrawer() {
  const drawer = document.getElementById('cart-drawer');
  const overlay = document.getElementById('sheet-overlay') || document.getElementById('cart-drawer-overlay');
  if (drawer) drawer.classList.remove('is-open');
  if (overlay) overlay.classList.remove('is-open');
  document.body.classList.remove('overflow-hidden');
}

export function closeAllDrawers() {
  closeHamburgerDrawer();
  closeCartDrawer();
  closeSearchDrawer();
  closeAboutModal();
  closeAccountModal();
  closeQuickAddSheet();
  const infoModal = document.getElementById('info-modal') || document.getElementById('store-info-modal');
  if (infoModal) infoModal.classList.remove('is-open');
}

/**
 * Modal Info / Envíos
 */
export function openStoreInfoModal() {
  const modal = document.getElementById('info-modal') || document.getElementById('store-info-modal');
  const overlay = document.getElementById('sheet-overlay') || document.getElementById('store-info-overlay');
  if (modal) modal.classList.add('is-open');
  if (overlay) overlay.classList.add('is-open');
  document.body.classList.add('overflow-hidden');
}

export function closeStoreInfoModal() {
  const modal = document.getElementById('info-modal') || document.getElementById('store-info-modal');
  const overlay = document.getElementById('sheet-overlay') || document.getElementById('store-info-overlay');
  if (modal) modal.classList.remove('is-open');
  if (overlay) overlay.classList.remove('is-open');
  document.body.classList.remove('overflow-hidden');
}

/**
 * Auto-inyección de elementos si no existen en la página
 */
export function ensureGlobalShellElements() {
  if (!document.body) return;

  // 1. Barra inferior de 5 botones si no existe
  if (!document.querySelector('.bottom-tab-bar')) {
    const isHome = window.location.pathname.endsWith('index.html') || window.location.pathname === '/' || window.location.pathname.endsWith('/roneoshop/');
    const isCatalog = window.location.pathname.includes('collection.html');

    const bottomBarHtml = `
      <nav class="bottom-tab-bar" aria-label="Navegación rápida inferior">
        <a href="index.html" class="bottom-tab-item ${isHome ? 'is-active' : ''}" aria-label="Inicio">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"></path>
          </svg>
          <span>Inicio</span>
        </a>
        <a href="collection.html?cat=todos" class="bottom-tab-item ${isCatalog ? 'is-active' : ''}" aria-label="Catálogo">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M6 3h12l2 5-8 13L4 8zM4 8h16M9 8l3 13M15 8l-3 13"></path>
          </svg>
          <span>Catálogo</span>
        </a>
        <button type="button" class="bottom-tab-item" data-action="open-about-modal" aria-label="Sobre mí">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"></path>
          </svg>
          <span>Sobre mí</span>
        </button>
        <button type="button" class="bottom-tab-item" data-action="open-cart" aria-label="Carrito">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M5 8h14l-1 12H6zM9 8V6a3 3 0 0 1 6 0v2"></path>
          </svg>
          <span class="cart-count-badge bottom-tab-badge is-empty">0</span>
          <span>Carrito</span>
        </button>
        <button type="button" class="bottom-tab-item" data-action="open-account-modal" aria-label="Cuenta">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="12" cy="8" r="4"></circle>
            <path d="M4 20c1.5-4 5-5 8-5s6.5 1 8 5"></path>
          </svg>
          <span>Cuenta</span>
        </button>
      </nav>
    `;
    document.body.insertAdjacentHTML('beforeend', bottomBarHtml);
  }

  // 2. Modal Sobre mí si no existe
  if (!document.getElementById('about-modal')) {
    const aboutHtml = `
      <div id="about-modal" class="editorial-modal" role="dialog" aria-modal="true" aria-labelledby="about-modal-title">
        <div class="editorial-modal__backdrop" data-action="close-about-modal"></div>
        <div class="editorial-modal__dialog">
          <button type="button" class="editorial-modal__close" data-action="close-about-modal" aria-label="Cerrar modal">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
          <div class="modal-editorial-body">
            <div class="modal-editorial-icon">
              <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M20 10c0 5.5-8 12-8 12s-8-6.5-8-12a8 8 0 1 1 16 0Z"></path>
                <circle cx="12" cy="10" r="3"></circle>
              </svg>
            </div>
            <h3 id="about-modal-title" class="modal-editorial-title">Información &middot; Roneo Shop</h3>
            <p class="modal-editorial-subtitle">Moda &middot; Tendencia &middot; Confianza</p>
            <p class="modal-editorial-desc">
              Envíos directos desde Andalucía (Torredonjimeno, Jaén) a toda España Península en 24/48 horas laborables con Correos y Correos Express.
            </p>
            <div class="modal-editorial-box">
              <p><strong>Envíos:</strong> Gratis en pedidos superiores a 80,00 €. Regalo sorpresa exclusivo en pedidos desde 150,00 €.</p>
              <p><strong>Pagos:</strong> 100% seguros con Tarjeta bancaria y Bizum.</p>
              <p><strong>Atención directa:</strong> ¿Dudas con tu talla o pedido? Te asesoramos directamente por WhatsApp.</p>
            </div>
            <div style="display: flex; flex-direction: column; gap: 8px;">
              <a href="https://wa.me/34600000000?text=Hola%20Roneo%20Shop,%20tengo%20una%20consulta" target="_blank" rel="noopener" class="btn-primary" style="text-decoration: none;">
                Hablar por WhatsApp
              </a>
              <a href="https://www.tiktok.com/@roneoshop" target="_blank" rel="noopener noreferrer" style="display: flex; align-items: center; justify-content: center; gap: 8px; text-decoration: none; height: 44px; border-radius: 8px; font-weight: 600; font-size: 13px; color: #4d2525; border: 1.5px solid #dfc298; background: #faf8f5;">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/></svg>
                <span>Ver Ropa en TikTok (@roneoshop)</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', aboutHtml);
  }

  // 3. Modal Cuenta si no existe
  if (!document.getElementById('account-preview-modal')) {
    const accountHtml = `
      <div id="account-preview-modal" class="editorial-modal" role="dialog" aria-modal="true" aria-labelledby="account-modal-title">
        <div class="editorial-modal__backdrop" data-action="close-account-modal"></div>
        <div class="editorial-modal__dialog">
          <button type="button" class="editorial-modal__close" data-action="close-account-modal" aria-label="Cerrar modal">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
          <div class="modal-editorial-body">
            <div class="modal-editorial-icon">
              <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="8" r="4"></circle><path d="M4 20c1.5-4 5-5 8-5s6.5 1 8 5"></path></svg>
            </div>
            <h3 id="account-modal-title" class="modal-editorial-title">Mi Cuenta &middot; Roneo Shop</h3>
            <p class="modal-editorial-subtitle">Próximamente disponible</p>
            <p class="modal-editorial-desc">
              Estamos preparando tu área privada de clienta para que puedas guardar tus prendas favoritas, consultar tu historial de pedidos y gestionar tus envíos con un solo clic.
            </p>
            <div class="modal-editorial-box">
              <p>¿Has hecho un pedido y quieres consultar su seguimiento? Escríbenos indicando tu código de pedido:</p>
              <a href="https://wa.me/34600000000?text=Hola%20Roneo%20Shop,%20quiero%20consultar%20el%20seguimiento%20de%20mi%20pedido" target="_blank" rel="noopener" class="btn-primary" style="margin-top: 8px; text-decoration: none;">
                Consultar por WhatsApp
              </a>
            </div>
            <a href="admin/index.html" style="font-size: 12px; color: #8c7878; text-decoration: underline; margin-top: 12px; display: inline-block;">
              Acceso Administración (/admin)
            </a>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', accountHtml);
  }

  // 4. Overlay general
  if (!document.getElementById('sheet-overlay')) {
    const overlay = document.createElement('div');
    overlay.id = 'sheet-overlay';
    overlay.className = 'sheet-overlay';
    document.body.appendChild(overlay);
  }
}

/**
 * Delegación global de eventos infalible
 */
let delegatedListenersInitialized = false;
export function initGlobalNavigationShell() {
  ensureGlobalShellElements();

  if (delegatedListenersInitialized) return;
  delegatedListenersInitialized = true;

  document.addEventListener('click', (e) => {
    // Abrir Modal Info / Sobre mí
    if (e.target.closest('[data-action="open-info-modal"], [data-action="open-about-modal"]')) {
      e.preventDefault();
      closeAllDrawers();
      openAboutModal();
      return;
    }

    // Cerrar Modal Info / Sobre mí
    if (e.target.closest('[data-action="close-info-modal"], [data-action="close-about-modal"]')) {
      e.preventDefault();
      closeAboutModal();
      return;
    }

    // Abrir Modal Cuenta
    if (e.target.closest('[data-action="open-account-modal"]')) {
      e.preventDefault();
      closeAllDrawers();
      openAccountModal();
      return;
    }

    // Cerrar Modal Cuenta
    if (e.target.closest('[data-action="close-account-modal"]')) {
      e.preventDefault();
      closeAccountModal();
      return;
    }

    // Abrir Carrito
    if (e.target.closest('#header-cart-btn, #btn-open-cart, [data-action="open-cart"], .js-open-cart-drawer')) {
      e.preventDefault();
      renderCartDrawer();
      openCartDrawer();
      return;
    }

    // Cerrar Carrito
    if (e.target.closest('#cart-drawer-close, [data-action="close-cart"]')) {
      e.preventDefault();
      closeCartDrawer();
      return;
    }

    // Alternar / Abrir Buscador
    if (e.target.closest('#header-search-btn, #header-search-btn-desktop, #btn-open-search, [data-action="open-search"], [data-action="toggle-search"]')) {
      e.preventDefault();
      toggleSearchDrawer();
      return;
    }

    // Cerrar Buscador
    if (e.target.closest('#search-close-btn, [data-action="close-search"]')) {
      e.preventDefault();
      closeSearchDrawer();
      return;
    }

    // Abrir Menú Hamburguesa
    if (e.target.closest('#header-menu-btn, #btn-open-menu, [data-action="open-menu"]')) {
      e.preventDefault();
      openHamburgerDrawer();
      return;
    }

    // Cerrar Menú Hamburguesa
    if (e.target.closest('#hamburger-close-btn, [data-action="close-menu"]')) {
      e.preventDefault();
      closeHamburgerDrawer();
      return;
    }

    // Clic en el backdrop general (cierra cualquier drawer o modal)
    if (e.target.id === 'sheet-overlay') {
      e.preventDefault();
      closeAllDrawers();
      return;
    }

    // Modal Info Envíos
    if (e.target.closest('[data-action="open-info-modal"]')) {
      e.preventDefault();
      openStoreInfoModal();
      return;
    }
    if (e.target.closest('#info-close-btn, [data-action="close-info-modal"]')) {
      e.preventDefault();
      closeStoreInfoModal();
      return;
    }

    // Acciones del Carrito (eliminar / sumar / restar)
    const removeBtn = e.target.closest('[data-action="remove-cart-item"]');
    if (removeBtn) {
      e.preventDefault();
      const cId = removeBtn.getAttribute('data-cart-id');
      if (cId) removeFromCart(cId);
      return;
    }

    const decBtn = e.target.closest('[data-action="dec-cart-qty"]');
    if (decBtn) {
      e.preventDefault();
      const cId = decBtn.getAttribute('data-cart-id');
      const cart = getCart();
      const item = cart.find(x => x.cartItemId === cId);
      if (item) updateCartItemQuantity(cId, item.quantity - 1);
      return;
    }

    const incBtn = e.target.closest('[data-action="inc-cart-qty"]');
    if (incBtn) {
      e.preventDefault();
      const cId = incBtn.getAttribute('data-cart-id');
      const cart = getCart();
      const item = cart.find(x => x.cartItemId === cId);
      if (item) updateCartItemQuantity(cId, item.quantity + 1);
      return;
    }
  });

  // Buscador interactivo
  setupLiveSearch();
}

function setupLiveSearch() {
  const input = document.getElementById('search-input') || document.getElementById('global-search-input');
  if (!input) return;

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const q = input.value.trim();
      if (q) {
        window.location.href = `collection.html?q=${encodeURIComponent(q)}`;
      }
    }
  });
}

/**
 * Renderiza el carrusel horizontal de secciones de portada
 */
export function renderHomeSections() {
  const track = document.getElementById('home-sections-track');
  if (!track) return;

  // Orden oficial prioritario Fase 8.2: 1º Conjuntos Deportivos, 2º Abrigos, 3º Tops, 4º Pantalones, 5º Vestidos, 6º Camisas, 7º Calzado
  const sections = [
    { title: 'Conjuntos Deportivos', cat: 'conjuntos-deportivos', img: 'https://images.unsplash.com/photo-1509631179647-0177331693ae?auto=format&fit=crop&w=600&q=80' },
    { title: 'Abrigos', cat: 'abrigos', img: 'https://images.unsplash.com/photo-1544441893-675973e31985?auto=format&fit=crop&w=600&q=80' },
    { title: 'Tops', cat: 'tops', img: 'https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?auto=format&fit=crop&w=600&q=80' },
    { title: 'Pantalones', cat: 'pantalones', img: 'https://images.unsplash.com/photo-1541099649105-f69ad21f3246?auto=format&fit=crop&w=600&q=80' },
    { title: 'Vestidos', cat: 'vestidos', img: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=600&q=80' },
    { title: 'Camisas', cat: 'camisas', img: 'https://images.unsplash.com/photo-1598554747436-c9293d6a588f?auto=format&fit=crop&w=600&q=80' },
    { title: 'Calzado', cat: 'calzado', img: 'https://images.unsplash.com/photo-1543163521-1bf539c55dd2?auto=format&fit=crop&w=600&q=80' }
  ];

  const sectionsHash = sections.map(s => `${s.title}:${s.cat}`).join('|');
  if (track.dataset.renderedHash === sectionsHash) return;
  track.dataset.renderedHash = sectionsHash;

  track.innerHTML = sections.map((s, idx) => `
    <a href="collection.html?cat=${encodeURIComponent(s.cat)}" class="home-section-card" data-motion="zoom" style="--motion-delay: ${idx * 60}ms;">
      <img src="${s.img}" alt="${s.title}" class="home-section-card__img" loading="lazy">
      <div class="home-section-card__overlay">
        <span class="home-section-card__title">${s.title}</span>
      </div>
    </a>
  `).join('');
  refreshScrollAnimations();
}

/**
 * Renderiza la cuadrícula de Novedades en portada
 */
export function renderHomeNovedades(products = allProducts) {
  const grid = document.getElementById('home-novedades-grid');
  if (!grid) return;

  const items = (products && products.length > 0) ? products.slice(0, 8) : [];
  const hash = computeProductsFingerprint(items);
  if (grid.dataset.renderedHash === hash) return;
  grid.dataset.renderedHash = hash;

  grid.innerHTML = items.map((p, idx) => renderProductCardMarkup(p, idx)).join('');
  bindProductCardEvents(grid, items);
  refreshScrollAnimations();
}

/**
 * Renderiza el Drawer del Carrito
 */
export function renderCartDrawer() {
  const cart = getCart();
  const threshold = Number(currentSettings?.freeShippingThreshold ?? 80.00);
  const giftThreshold = Number(currentSettings?.freeGiftThreshold ?? 150.00);
  const shipPrice = Number(currentSettings?.shippingStandardPrice ?? 4.99);
  const totals = getCartTotals(threshold, shipPrice, giftThreshold);
  const totalUnits = totals.totalUnits || 0;

  // Sincronizar título
  const drawerTitle = document.getElementById('cart-drawer-title');
  if (drawerTitle) {
    drawerTitle.textContent = `Tu cesta (${totalUnits})`;
  }

  // Doble barra de progreso de recompensas en vivo (Envío gratis 80€ + Regalo exclusivo 150€)
  const rewardsBox = document.getElementById('cart-rewards-container') || document.querySelector('.cart-rewards-box') || document.querySelector('.cart-free-shipping-bar');
  if (rewardsBox) {
    const isFreeShip = totals.subtotal >= threshold && totals.subtotal > 0;
    const isFreeGift = totals.subtotal >= giftThreshold && totals.subtotal > 0;
    const shipPct = Math.min(100, (totals.subtotal / threshold) * 100).toFixed(1);
    const giftPct = Math.min(100, (totals.subtotal / giftThreshold) * 100).toFixed(1);

    rewardsBox.outerHTML = `
      <div id="cart-rewards-container" class="cart-rewards-box">
        <!-- META 1: ENVÍO GRATIS A LOS 80€ -->
        <div class="cart-reward-tier ${isFreeShip ? 'is-unlocked' : ''}">
          <div class="cart-reward-tier__header">
            <span class="cart-reward-tier__icon">
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 7h11v10H3z"></path>
                <path d="M14 10h4l3 3v4h-7z"></path>
                <circle cx="7" cy="18" r="1.5"></circle>
                <circle cx="17" cy="18" r="1.5"></circle>
              </svg>
            </span>
            <span class="cart-reward-tier__text">
              ${isFreeShip
                ? '<strong>¡Envío GRATIS conseguido!</strong> (Pedido +80,00 €)'
                : `Te faltan <strong>${formatEuroPrice(threshold - totals.subtotal)}</strong> para <strong>ENVÍO GRATIS</strong> (80,00 €)`
              }
            </span>
          </div>
          <div class="cart-reward-tier__bar">
            <div class="cart-reward-tier__fill" style="width: ${shipPct}%;"></div>
          </div>
        </div>

        <!-- META 2: REGALO DISPONIBLE A LOS 150€ -->
        <div class="cart-reward-tier cart-reward-tier--gift ${isFreeGift ? 'is-unlocked' : ''}">
          <div class="cart-reward-tier__header">
            <span class="cart-reward-tier__icon">
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 12 20 22 4 22 4 12"></polyline>
                <rect x="2" y="7" width="20" height="5"></rect>
                <line x1="12" y1="22" x2="12" y2="7"></line>
                <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"></path>
                <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"></path>
              </svg>
            </span>
            <span class="cart-reward-tier__text">
              ${isFreeGift
                ? '<strong>¡REGALO EXCLUSIVO desbloqueado!</strong> Incluido gratis en tu pedido'
                : `Te faltan <strong>${formatEuroPrice(giftThreshold - totals.subtotal)}</strong> para tu <strong>REGALO EXCLUSIVO</strong> (150,00 €)`
              }
            </span>
          </div>
          <div class="cart-reward-tier__bar">
            <div class="cart-reward-tier__fill cart-reward-tier__fill--gift" style="width: ${giftPct}%;"></div>
          </div>
        </div>
      </div>
    `;
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

    const subtotalEl = document.getElementById('cart-drawer-subtotal');
    if (subtotalEl) subtotalEl.textContent = formatEuroPrice(totals.subtotal);

    if (itemsContainer) {
      const itemsHtml = cart.map(item => `
        <div class="cart-drawer-item" data-cart-id="${escapeHtml(item.cartItemId)}" style="display: flex; gap: 12px; padding: 14px 0; border-bottom: 1px solid #f1efec;">
          <a href="product.html?id=${encodeURIComponent(item.productId)}" style="width: 72px; height: 90px; border-radius: 8px; overflow: hidden; flex-shrink: 0; background: #f3f1ed; display: block;">
            <img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.title)}" style="width: 100%; height: 100%; object-fit: cover;">
          </a>
          <div style="flex: 1; display: flex; flex-direction: column; justify-content: space-between;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px;">
              <a href="product.html?id=${encodeURIComponent(item.productId)}" style="font-size: 13.5px; font-weight: 500; color: #231515; line-height: 1.3;">
                ${escapeHtml(formatCleanTitle(item.title))}
              </a>
              <button type="button" data-action="remove-cart-item" data-cart-id="${escapeHtml(item.cartItemId)}" aria-label="Eliminar" style="color: #8c7878; cursor: pointer; padding: 2px;">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
              </button>
            </div>

            <div style="font-size: 11.5px; color: #7a6868; margin-top: 4px;">
              ${item.color ? `Color: <strong>${escapeHtml(item.color)}</strong> &middot; ` : ''}
              ${item.size ? `Talla: <strong>${escapeHtml(item.size)}</strong>` : ''}
            </div>

            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 8px;">
              <div style="display: inline-flex; align-items: center; border: 1px solid #dedad4; border-radius: 6px;">
                <button type="button" data-action="dec-cart-qty" data-cart-id="${escapeHtml(item.cartItemId)}" style="width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; cursor: pointer;">&minus;</button>
                <span style="font-size: 12.5px; font-weight: 600; padding: 0 6px;">${item.quantity}</span>
                <button type="button" data-action="inc-cart-qty" data-cart-id="${escapeHtml(item.cartItemId)}" style="width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; cursor: pointer;">&plus;</button>
              </div>
              <div style="font-size: 13.5px; font-weight: 500; font-variant-numeric: tabular-nums;">
                ${formatEuroPrice(Number(item.price) * Number(item.quantity))}
              </div>
            </div>
          </div>
        </div>
      `).join('');

      const giftCardHtml = (totals.subtotal >= giftThreshold) ? `
        <div class="cart-gift-unlocked-card">
          <div style="display: flex; align-items: center; gap: 10px;">
            <div style="width: 36px; height: 36px; border-radius: 8px; background: #4d2525; display: flex; align-items: center; justify-content: center; flex-shrink: 0; color: #dfc298;">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 12 20 22 4 22 4 12"></polyline>
                <rect x="2" y="7" width="20" height="5"></rect>
                <line x1="12" y1="22" x2="12" y2="7"></line>
                <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"></path>
                <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"></path>
              </svg>
            </div>
            <div>
              <div style="font-size: 13px; font-weight: 600; color: #231515;">Regalo Exclusivo Roneo Shop</div>
              <div style="font-size: 11px; color: #7a6868;">Por compra igual o superior a 150,00 €</div>
            </div>
          </div>
          <div style="font-size: 12.5px; font-weight: 700; color: #157347; white-space: nowrap;">
            GRATIS (0,00 €)
          </div>
        </div>
      ` : '';

      itemsContainer.innerHTML = itemsHtml + giftCardHtml;
    }
  }

  updateCartBadges();
}

/**
 * Sincroniza los contadores de carrito
 */
export function updateCartBadges() {
  const totals = getCartTotals();
  const totalUnits = totals.totalUnits || 0;

  document.querySelectorAll('.cart-count-badge, .cart-badge, #header-cart-badge, #header-cart-count, #bottom-tab-badge, .header-nav-badge').forEach(badge => {
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
 * Ticker marquee de la barra superior
 */
export function renderAnnouncementMarquee(rawText) {
  const cleanText = (rawText || "NUEVA COLECCIÓN OTOÑO & INVIERNO · ENVÍO GRATIS EN PEDIDOS +80€ · REGALO EN PEDIDOS +150€ · ENVÍO 24/48H CORREOS").trim();
  const bars = document.querySelectorAll('.announcement-bar');
  bars.forEach(bar => {
    const itemsHtml = Array.from({ length: 4 })
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
 * Aplica ajustes de la tienda al DOM
 */
export function applySettingsToDOM(settings) {
  if (!settings) return;
  currentSettings = settings;

  // Portada Hero sin parpadeos ni fotos antiguas de muestra
  const heroImg = document.getElementById('hero-main-img') || document.getElementById('hero-lux-img') || document.querySelector('.hero-lux__img');
  if (heroImg) {
    if (settings.heroImage && !settings.heroImage.includes('unsplash.com')) {
      if (heroImg.getAttribute('src') !== settings.heroImage) {
        heroImg.src = settings.heroImage;
        heroImg.style.opacity = '1';
        localStorage.setItem('roneo_hero_image_v1', settings.heroImage);
      }
    } else if (settings.heroImage && settings.heroImage.includes('unsplash.com')) {
      localStorage.removeItem('roneo_hero_image_v1');
    }
  }

  // Ticker de anuncios
  if (settings.announcementText) {
    renderAnnouncementMarquee(settings.announcementText);

    // Ticker oficial de portada integrado en bucle infinito bajo #nueva-coleccion
    const homeMarquee = document.getElementById('home-announcement-marquee');
    if (homeMarquee) {
      const items = homeMarquee.querySelectorAll('.launch-marquee__item');
      if (items.length > 0) {
        items.forEach(it => {
          it.innerHTML = `${escapeHtml(settings.announcementText)}<span class="launch-marquee__star"><svg viewBox="0 0 12 12" width="10" height="10" fill="currentColor" aria-hidden="true"><path d="M6 0L7.5 4.5L12 6L7.5 7.5L6 12L4.5 7.5L0 6L4.5 4.5L6 0Z"/></svg></span>`;
        });
      }
    }
  }
}

/**
 * Quick Add Bottom Sheet
 */
export function openQuickAddSheet(product) {
  modalProduct = product;
  const sheet = document.getElementById('quick-add-sheet');
  const overlay = document.getElementById('sheet-overlay');
  if (!sheet) return;

  const imgEl = document.getElementById('modal-sheet-img');
  const titleEl = document.getElementById('modal-sheet-title');
  const priceEl = document.getElementById('modal-sheet-price');
  const sizePillsContainer = document.getElementById('modal-size-pills');

  if (imgEl) imgEl.src = product.images?.[0] || '';
  if (titleEl) titleEl.textContent = formatCleanTitle(product.title);
  if (priceEl) priceEl.textContent = formatEuroPrice(product.price);

  const variants = product.variants || [];
  if (sizePillsContainer) {
    sizePillsContainer.innerHTML = variants.map((v, idx) => {
      const isOut = v.stock <= 0;
      const isSelected = idx === 0 && !isOut;
      if (isSelected) modalSelectedSize = v.size;
      return `
        <button type="button" class="size-pill ${isSelected ? 'is-selected' : ''} ${isOut ? 'is-out' : ''}" data-size="${escapeHtml(v.size)}" ${isOut ? 'disabled' : ''}>
          ${escapeHtml(v.size)}
        </button>
      `;
    }).join('');

    sizePillsContainer.querySelectorAll('.size-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        sizePillsContainer.querySelectorAll('.size-pill').forEach(b => b.classList.remove('is-selected'));
        btn.classList.add('is-selected');
        modalSelectedSize = btn.dataset.size;
      });
    });
  }

  sheet.classList.add('is-open');
  if (overlay) overlay.classList.add('is-open');
  document.body.classList.add('overflow-hidden');
}

export function closeQuickAddSheet() {
  const sheet = document.getElementById('quick-add-sheet');
  const overlay = document.getElementById('sheet-overlay');
  if (sheet) sheet.classList.remove('is-open');
  if (overlay) overlay.classList.remove('is-open');
  document.body.classList.remove('overflow-hidden');
}

/**
 * Configuración global
 */
export function setupCommonUI() {
  initGlobalNavigationShell();
  initBrandIntro();
  initHeroParallax();
  initWordsRevealFx();
  refreshScrollAnimations();

  window.addEventListener('cart:updated', (e) => {
    renderCartDrawer();
    updateCartBadges();
    if (e.detail?.openDrawer) {
      openCartDrawer();
    }
  });

  const modalAddBtn = document.getElementById('modal-btn-add');
  if (modalAddBtn) {
    modalAddBtn.addEventListener('click', () => {
      if (!modalProduct) return;
      const sizeToAdd = modalSelectedSize || 'Única';
      const colorToAdd = modalSelectedColor ? modalSelectedColor.name : 'Color Único';
      const colorHexToAdd = modalSelectedColor ? modalSelectedColor.hex : '#121212';

      const success = addToCart(modalProduct, sizeToAdd, 1, colorToAdd, colorHexToAdd);
      if (success) {
        closeQuickAddSheet();
        openCartDrawer();
      }
    });
  }

  const sheetCloseBtn = document.getElementById('sheet-close-btn');
  if (sheetCloseBtn) {
    sheetCloseBtn.addEventListener('click', closeQuickAddSheet);
  }
}

/**
 * Manejador del estado de scroll del Header (gestionado por initSmartHeaderAndBannerScroll)
 */
export function handleHeaderScrollState() {
  // Integrado en initSmartHeaderAndBannerScroll
}

/**
 * Cortina editorial de bienvenida (retrocompatibilidad)
 */
export function initBrandIntro() {
  const introEl = document.getElementById('roneo-intro');
  if (introEl) {
    introEl.classList.add('is-hidden');
    setTimeout(() => introEl.remove(), 400);
  }
}

/**
 * Parallax continuo y sutil en el Hero con scroll
 */
export function initHeroParallax() {
  const heroLux = document.querySelector('.hero-lux');
  if (!heroLux) return;

  const photos = heroLux.querySelector('.hero-lux__photos');
  const brand = heroLux.querySelector('.hero-lux__brand');
  if (!photos && !brand) return;

  let ticking = false;
  window.addEventListener('scroll', () => {
    if (!ticking) {
      window.requestAnimationFrame(() => {
        const scrollY = window.scrollY || window.pageYOffset || 0;
        if (scrollY < 850) {
          if (photos) {
            photos.style.transform = `translate3d(0, ${scrollY * 0.16}px, 0)`;
          }
          if (brand) {
            const opacity = Math.max(0, 1 - (scrollY / 360));
            brand.style.opacity = opacity.toFixed(3);
            brand.style.transform = `translate3d(0, ${scrollY * 0.08}px, 0)`;
          }
        }
        ticking = false;
      });
      ticking = true;
    }
  }, { passive: true });
}

/**
 * Efecto Words Reveal Mask para títulos editoriales
 */
export function initWordsRevealFx() {
  const targets = document.querySelectorAll('[data-fx="words"]');
  if (!targets.length) return;

  targets.forEach(target => {
    if (target.dataset.wordsReady === 'true' || target.dataset.fxSplitted === 'true') {
      target.classList.add('is-revealed');
      return;
    }

    const text = target.textContent.trim();
    if (!text) return;

    const words = text.split(/\s+/);
    target.innerHTML = words.map((w, i) => {
      return `<span class="fx-word-mask"><span class="fx-word" style="--word-delay: ${i * 70}ms;">${escapeHtml(w)}</span></span>`;
    }).join(' ');

    target.dataset.fxSplitted = 'true';
    target.dataset.wordsReady = 'true';
  });

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries, obs) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-revealed');
          obs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -20px 0px' });

    targets.forEach(el => observer.observe(el));
  } else {
    targets.forEach(el => el.classList.add('is-revealed'));
  }
}

/**
 * Refresco general de animaciones por scroll (Motion & Curtains)
 */
export function refreshScrollAnimations() {
  const elements = document.querySelectorAll('[data-motion]:not(.is-revealed):not(.is-inview), [data-fx="curtain"]:not(.is-revealed):not(.is-inview)');
  if (!elements.length) return;

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries, obs) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-revealed');
          entry.target.classList.add('is-inview');
          obs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.05, rootMargin: '0px 0px -20px 0px' });

    elements.forEach(el => observer.observe(el));

    // Fallback anti-invisibilidad: tras 450ms, revelar elementos dentro o cerca del viewport
    setTimeout(() => {
      elements.forEach(el => {
        const rect = el.getBoundingClientRect();
        if (rect.top < window.innerHeight + 120) {
          el.classList.add('is-revealed');
          el.classList.add('is-inview');
        }
      });
    }, 450);
  } else {
    elements.forEach(el => {
      el.classList.add('is-revealed');
      el.classList.add('is-inview');
    });
  }
}

// Variables de control del temporizador de 7s en portada
let homeBannerTimer = null;
let canTriggerHomeBanner = true;

/**
 * Controlador inteligente del Banner de anuncios y Navbar con Scroll
 */
export function initSmartHeaderAndBannerScroll() {
  const isHome = document.body.classList.contains('home-page');

  function updateScrollState() {
    const y = window.scrollY || window.pageYOffset || 0;

    if (!isHome) {
      if (y >= 32) {
        document.body.classList.add('inner-header-stuck');
      } else {
        document.body.classList.remove('inner-header-stuck');
      }
      return;
    }

    // LÓGICA EN INDEX.HTML (body.home-page)
    if (y <= 40) {
      document.body.classList.remove('is-scrolled', 'show-top-banner', 'navbar-choco-glass');
      if (homeBannerTimer) {
        clearTimeout(homeBannerTimer);
        homeBannerTimer = null;
      }
      canTriggerHomeBanner = true;
      return;
    }

    document.body.classList.add('is-scrolled');

    // Detectar si la navbar se encuentra sobre el tramo achocolatado (Hero o #nueva-coleccion)
    const launchSection = document.getElementById('nueva-coleccion') || document.querySelector('.launch-section');
    if (launchSection) {
      const rect = launchSection.getBoundingClientRect();
      const triggerOffset = document.body.classList.contains('show-top-banner') ? 92 : 60;
      if (rect.bottom > triggerOffset) {
        document.body.classList.add('navbar-choco-glass');
      } else {
        document.body.classList.remove('navbar-choco-glass');
      }
    }

    // Temporizador exclusivo de 7 segundos para el banner de anuncios superior
    if (canTriggerHomeBanner) {
      canTriggerHomeBanner = false;
      document.body.classList.add('show-top-banner');

      if (homeBannerTimer) clearTimeout(homeBannerTimer);
      homeBannerTimer = setTimeout(() => {
        document.body.classList.remove('show-top-banner');
        homeBannerTimer = null;
      }, 7000);
    }
  }

  window.addEventListener('scroll', updateScrollState, { passive: true });
  window.addEventListener('resize', updateScrollState, { passive: true });
  updateScrollState();
}

// Inicialización de la aplicación
document.addEventListener('DOMContentLoaded', async () => {
  try {
    initGlobalNavigationShell();
    initSmartHeaderAndBannerScroll();
    setupCommonUI();
    renderCartDrawer();
    updateCartBadges();

    const isHome = !!document.getElementById('home-sections-track') || !!document.getElementById('home-novedades-grid');

    if (isHome) {
      renderHomeSections();
    }

    // Suscripción o carga de productos
    unsubscribeProducts = subscribeToProducts((products) => {
      allProducts = products;
      if (isHome) {
        renderHomeNovedades(products);
      }
      renderCartDrawer();
      updateCartBadges();
      refreshScrollAnimations();
    });

    // Suscripción o carga de ajustes
    unsubscribeSettings = subscribeToSettings((settings) => {
      applySettingsToDOM(settings);
      renderCartDrawer();
      updateCartBadges();
    });

    initWordsRevealFx();
    refreshScrollAnimations();

  } catch (err) {
    console.error("[UI] Error durante la inicialización:", err);
  }
});

window.addEventListener('beforeunload', () => {
  if (typeof unsubscribeProducts === 'function') unsubscribeProducts();
  if (typeof unsubscribeSettings === 'function') unsubscribeSettings();
});
