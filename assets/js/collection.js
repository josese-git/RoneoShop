/**
 * COLLECTION PAGE CONTROLLER - RONEO SHOP (FASE 8.1 DEFINITIVA)
 * Controla el filtrado dinámico de colecciones con píldoras horizontales,
 * contador dinámico "XX PRENDAS", cuadrícula 2 cols móvil / 4 cols PC,
 * modal "Sobre mí", "Cuenta" y Cart Drawer.
 */

import {
  getProductsByFilter,
  getStoreSettings,
  subscribeToProducts,
  subscribeToSettings,
  computeProductsFingerprint
} from './store-service.js';
import {
  renderProductCardMarkup,
  bindProductCardEvents,
  setupCommonUI,
  renderCartDrawer,
  updateCartBadges,
  setupAnnouncement,
  applySettingsToDOM,
  refreshScrollAnimations,
  initWordsRevealFx
} from './ui.js';

// Estado de la página de colección
let activeCategory = 'todos';
let searchQuery = '';
let currentSort = 'featured';
let onlyInStock = false;
let selectedFilterSize = null;
let minPrice = null;
let maxPrice = null;
let currentProducts = [];
let unsubscribeProducts = null;
let unsubscribeSettings = null;

const CATEGORY_METADATA = {
  'todos': {
    title: 'Catálogo',
    pageTitle: 'Catálogo · Roneo Shop'
  },
  'ropa': {
    title: 'Ropa',
    pageTitle: 'Ropa Femenina · Roneo Shop'
  },
  'calzado': {
    title: 'Calzado',
    pageTitle: 'Calzado en Piel · Roneo Shop'
  },
  'otono-invierno': {
    title: 'Otoño & Invierno',
    pageTitle: 'Colección Otoño Invierno · Roneo Shop'
  },
  'primavera-verano': {
    title: 'Primavera & Verano',
    pageTitle: 'Colección Primavera Verano · Roneo Shop'
  },
  'rebajas': {
    title: 'Rebajas %',
    pageTitle: 'Rebajas Especiales · Roneo Shop'
  },
  'vestidos': {
    title: 'Vestidos',
    pageTitle: 'Vestidos de Fiesta y Diarios · Roneo Shop'
  },
  'conjuntos-deportivos': {
    title: 'Conjuntos Deportivos',
    pageTitle: 'Conjuntos Deportivos · Roneo Shop'
  },
  'conjuntos': {
    title: 'Conjuntos Deportivos',
    pageTitle: 'Conjuntos Deportivos · Roneo Shop'
  },
  'tops': {
    title: 'Tops y Camisetas',
    pageTitle: 'Tops y Camisas · Roneo Shop'
  },
  'camisas': {
    title: 'Camisas',
    pageTitle: 'Camisas Elegantes · Roneo Shop'
  },
  'pantalones': {
    title: 'Pantalones',
    pageTitle: 'Pantalones y Vaqueros · Roneo Shop'
  },
  'abrigos': {
    title: 'Abrigos',
    pageTitle: 'Abrigos y Chaquetas · Roneo Shop'
  },
  'chaquetas': {
    title: 'Abrigos',
    pageTitle: 'Abrigos y Chaquetas · Roneo Shop'
  },
  'vaqueros': {
    title: 'Vaqueros Faja',
    pageTitle: 'Vaqueros Efecto Faja · Roneo Shop'
  }
};

document.addEventListener('DOMContentLoaded', async () => {
  try {
    // 1. Leer parámetros de URL
    const params = new URLSearchParams(window.location.search);
    activeCategory = (params.get('cat') || 'todos').toLowerCase();
    searchQuery = params.get('q') || '';

    // 2. Configurar elementos interactivos comunes
    setupCatalogPills();
    setupCommonUI();
    renderCartDrawer();
    updateCartBadges();

    // 3. Renderizar catálogo inicial
    await applyAndRender();

    // 4. Suscripción en vivo al catálogo de productos
    unsubscribeProducts = subscribeToProducts(() => {
      applyAndRender();
    });

    // 5. Suscripción en vivo a ajustes de la tienda
    unsubscribeSettings = subscribeToSettings((settings) => {
      applySettingsToDOM(settings);
    });

  } catch (err) {
    console.error("[CollectionPage] Error durante la inicialización:", err);
  }
});

window.addEventListener('beforeunload', () => {
  if (typeof unsubscribeProducts === 'function') unsubscribeProducts();
  if (typeof unsubscribeSettings === 'function') unsubscribeSettings();
});

/**
 * Aplica los filtros vigentes y renderiza la cuadrícula de productos
 */
async function applyAndRender() {
  updateHeroMetadata();

  const products = await getProductsByFilter({
    category: activeCategory,
    search: searchQuery,
    onlyInStock,
    size: selectedFilterSize,
    minPrice,
    maxPrice,
    sortBy: currentSort
  });

  currentProducts = products;
  renderGrid(products);
}

/**
 * Actualiza los títulos y el estado de las píldoras activas
 */
function updateHeroMetadata() {
  const titleEl = document.getElementById('catalog-title') || document.getElementById('collection-title');
  const pageTitle = document.getElementById('collection-page-title');

  if (searchQuery.trim() !== '') {
    if (titleEl) titleEl.textContent = `Búsqueda: "${searchQuery}"`;
    if (pageTitle) pageTitle.textContent = `"${searchQuery}" | Roneo Shop`;
  } else {
    const meta = CATEGORY_METADATA[activeCategory] || { title: 'Catálogo', pageTitle: 'Catálogo | Roneo Shop' };
    if (titleEl) titleEl.textContent = meta.title;
    if (pageTitle) pageTitle.textContent = meta.pageTitle;
  }

  // Sincronizar estado de las píldoras de filtro
  document.querySelectorAll('.catalog-pill, .quick-pill').forEach(pill => {
    const pillCat = (pill.dataset.category || '').toLowerCase();
    if (pillCat === activeCategory) {
      pill.classList.add('is-active');
    } else {
      pill.classList.remove('is-active');
    }
  });

  // Marcar la pestaña Catálogo de la barra inferior como activa
  document.querySelectorAll('.bottom-tab-bar .bottom-tab-item').forEach(item => {
    const label = item.querySelector('span')?.textContent?.trim()?.toLowerCase();
    if (label === 'catálogo' || label === 'catalogo' || item.getAttribute('href')?.includes('collection.html')) {
      item.classList.add('is-active');
    } else {
      item.classList.remove('is-active');
    }
  });

  // Disparar animación tipográfica mask en título
  initWordsRevealFx();
}

/**
 * Renderiza la cuadrícula de productos según la referencia
 */
function renderGrid(products) {
  const gridEl = document.getElementById('collection-products-grid') || document.getElementById('collection-grid');
  const countEl = document.getElementById('catalog-count-label') || document.getElementById('collection-count');
  if (!gridEl) return;

  if (countEl) {
    countEl.textContent = `${products.length} PRENDAS`;
  }

  if (products.length === 0) {
    gridEl.dataset.renderedHash = "empty";
    gridEl.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 4rem 1rem; color: var(--color-text-muted);">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin: 0 auto 14px; opacity: 0.6;">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
        <h3 style="font-size: 16px; font-weight: 700; color: #231515; margin-bottom: 8px;">No se encontraron prendas</h3>
        <p style="font-size: 13px; max-width: 320px; margin: 0 auto 20px;">
          Actualmente no hay unidades disponibles en esta categoría.
        </p>
        <button type="button" id="reset-all-filters-btn" class="btn-primary" style="max-width: 200px; margin: 0 auto;">
          Ver Catálogo
        </button>
      </div>
    `;

    const resetBtn = document.getElementById('reset-all-filters-btn');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        activeCategory = 'todos';
        searchQuery = '';
        window.history.pushState({}, '', 'collection.html?cat=todos');
        applyAndRender();
      });
    }
    return;
  }

  const hash = computeProductsFingerprint(products);
  if (gridEl.dataset.renderedHash === hash) return;
  gridEl.dataset.renderedHash = hash;

  gridEl.innerHTML = products.map((product, idx) => renderProductCardMarkup(product, idx)).join('');
  bindProductCardEvents(gridEl, currentProducts);
  refreshScrollAnimations();
}

function setupCatalogPills() {
  document.querySelectorAll('.catalog-pill, .quick-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      activeCategory = (pill.dataset.category || 'todos').toLowerCase();
      searchQuery = '';
      window.history.pushState({}, '', `collection.html?cat=${encodeURIComponent(activeCategory)}`);
      applyAndRender();
    });
  });
}
