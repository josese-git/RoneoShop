/**
 * COLLECTION PAGE CONTROLLER - RONEO SHOP (FASE 5.1 DEFINITIVA)
 * Controla el filtrado dinámico de colecciones, ordenación,
 * modal de filtros Bottom-Sheet, cuadrícula responsiva y Quick-Add.
 * Sincronización en tiempo real (< 100ms) mediante onSnapshot (subscribeToProducts).
 * Zero Emojis · 100% Iconos SVG.
 */

import {
  getProductsByFilter,
  getStoreSettings,
  subscribeToProducts,
  subscribeToSettings
} from './store-service.js';
import {
  renderProductCardMarkup,
  bindProductCardEvents,
  setupCommonUI,
  renderCartDrawer,
  updateCartBadges,
  setupAnnouncement,
  applySettingsToDOM
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
    title: 'Todos los Productos',
    desc: 'Explora nuestra selección completa de prendas, calzado y novedades con envíos rápidos 24/48h.',
    pageTitle: 'Todos los Productos | Roneo Shop'
  },
  'ropa': {
    title: 'Moda Femenina',
    desc: 'Vaqueros faja moldeadores, vestidos elegantes de fiesta, conjuntos de punto fino y pantalones de corte sastre.',
    pageTitle: 'Moda Femenina | Roneo Shop'
  },
  'calzado': {
    title: 'Calzado Femenino',
    desc: 'Botines chelsea en piel vacuna, botas altas estructuradas y sneakers de plataforma confeccionadas para tu día a día.',
    pageTitle: 'Calzado Femenino | Roneo Shop'
  },
  'otono-invierno': {
    title: 'Otoño & Invierno',
    desc: 'Prendas cálidas y elegantes para los días fríos: abrigos estructurados de paño, punto canalé y denim reforzado.',
    pageTitle: 'Colección Otoño Invierno | Roneo Shop'
  },
  'primavera-verano': {
    title: 'Primavera & Verano',
    desc: 'Telas ligeras y fluidas: vestidos midi, satenes brillantes, bodies reductor escote espalda y pantalones palazzo.',
    pageTitle: 'Colección Primavera Verano | Roneo Shop'
  },
  'rebajas': {
    title: 'Rebajas Especiales',
    desc: 'Aprovecha descuentos exclusivos de temporada en prendas seleccionadas con unidades y tallas limitadas.',
    pageTitle: 'Rebajas % | Roneo Shop'
  },
  'novedades': {
    title: 'Novedades 2026',
    desc: 'Las últimas incorporaciones a nuestro catálogo: cortes favorecedores, colores tendencia y confección de vanguardia.',
    pageTitle: 'Novedades | Roneo Shop'
  },
  'vestidos': {
    title: 'Vestidos de Fiesta y Diarios',
    desc: 'Diseños que realzan la figura femenina con caídas espectaculares para eventos especiales o tu día a día.',
    pageTitle: 'Vestidos | Roneo Shop'
  },
  'abrigos': {
    title: 'Abrigos y Chaquetas',
    desc: 'Abrigos midi de paño estructurado y prendas de abrigo con acabados premium y forro de satén.',
    pageTitle: 'Abrigos | Roneo Shop'
  },
  'vaqueros': {
    title: 'Vaqueros Efecto Faja',
    desc: 'Nuestros famosos vaqueros moldeadores con tiro extra alto y confort elástico garantizado.',
    pageTitle: 'Vaqueros Faja | Roneo Shop'
  }
};

document.addEventListener('DOMContentLoaded', async () => {
  try {
    // 1. Leer parámetros de URL
    const params = new URLSearchParams(window.location.search);
    activeCategory = (params.get('cat') || 'todos').toLowerCase();
    searchQuery = params.get('q') || '';

    // 2. Configurar elementos interactivos comunes
    setupQuickPills();
    setupSortSelect();
    setupFilterModal();
    setupCommonUI();
    renderCartDrawer();
    updateCartBadges();

    // 3. Renderizar catálogo inicial
    await applyAndRender();

    // 4. Suscripción en vivo al catálogo de productos con onSnapshot (< 100ms)
    unsubscribeProducts = subscribeToProducts(() => {
      applyAndRender();
    });

    // 5. Suscripción en vivo a los ajustes con onSnapshot (< 100ms)
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
 * Actualiza los textos del Hero editorial y del título de pestaña
 */
function updateHeroMetadata() {
  const titleEl = document.getElementById('collection-title');
  const descEl = document.getElementById('collection-desc');
  const pageTitle = document.getElementById('collection-page-title');

  if (searchQuery.trim() !== '') {
    if (titleEl) titleEl.textContent = `Búsqueda: "${searchQuery}"`;
    if (descEl) descEl.textContent = `Mostrando resultados que coinciden con tu búsqueda.`;
    if (pageTitle) pageTitle.textContent = `Resultados para "${searchQuery}" | Roneo Shop`;
    return;
  }

  const meta = CATEGORY_METADATA[activeCategory] || CATEGORY_METADATA['todos'];
  if (titleEl) titleEl.textContent = meta.title;
  if (descEl) descEl.textContent = meta.desc;
  if (pageTitle) pageTitle.textContent = meta.pageTitle;

  document.querySelectorAll('.quick-pill').forEach(pill => {
    if (pill.dataset.category === activeCategory) {
      pill.classList.add('is-active');
    } else {
      pill.classList.remove('is-active');
    }
  });

  // Marcar la pestaña Productos de la barra inferior como activa
  document.querySelectorAll('.bottom-tab-bar .bottom-tab-item').forEach(item => {
    if (item.getAttribute('data-tab') === 'products' || item.getAttribute('data-nav') === 'products' || item.id === 'bottom-tab-productos') {
      item.classList.add('is-active');
    } else {
      item.classList.remove('is-active');
    }
  });
}

/**
 * Renderiza la cuadrícula de productos
 */
function renderGrid(products) {
  const gridEl = document.getElementById('collection-grid');
  const countEl = document.getElementById('collection-count');
  if (!gridEl) return;

  if (countEl) {
    countEl.textContent = `${products.length} ${products.length === 1 ? 'artículo' : 'artículos'}`;
  }

  if (products.length === 0) {
    gridEl.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 4rem 1rem; color: var(--color-text-muted);">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin: 0 auto 14px; opacity: 0.6;">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
        <h3 style="font-size: 16px; font-weight: 700; color: #121212; margin-bottom: 8px;">No se encontraron productos</h3>
        <p style="font-size: 13px; max-width: 320px; margin: 0 auto 20px;">
          Prueba a cambiar los filtros o consulta toda nuestra colección.
        </p>
        <button type="button" id="reset-all-filters-btn" class="btn-primary" style="max-width: 200px; margin: 0 auto;">
          Ver Todo el Catálogo
        </button>
      </div>
    `;

    const resetBtn = document.getElementById('reset-all-filters-btn');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        activeCategory = 'todos';
        searchQuery = '';
        onlyInStock = false;
        selectedFilterSize = null;
        minPrice = null;
        maxPrice = null;
        resetFilterFormInputs();
        window.history.pushState({}, '', 'collection.html?cat=todos');
        applyAndRender();
      });
    }
    return;
  }

  gridEl.innerHTML = products.map(product => renderProductCardMarkup(product)).join('');
  bindProductCardEvents(gridEl, currentProducts);
}

function setupQuickPills() {
  document.querySelectorAll('.quick-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      activeCategory = pill.dataset.category.toLowerCase();
      searchQuery = '';
      window.history.pushState({}, '', `collection.html?cat=${encodeURIComponent(activeCategory)}`);
      applyAndRender();
    });
  });
}

function setupSortSelect() {
  const sortSelect = document.getElementById('collection-sort-select');
  if (sortSelect) {
    sortSelect.addEventListener('change', (e) => {
      currentSort = e.target.value;
      applyAndRender();
    });
  }
}

function setupFilterModal() {
  const openBtn = document.getElementById('open-filter-btn');
  const sheet = document.getElementById('filter-sheet');
  const closeBtn = document.getElementById('filter-close-btn');
  const applyBtn = document.getElementById('filter-apply-btn');
  const resetBtn = document.getElementById('filter-reset-btn');
  const overlay = document.getElementById('sheet-overlay');

  if (openBtn && sheet && overlay) {
    openBtn.addEventListener('click', () => {
      sheet.classList.add('is-open');
      overlay.classList.add('is-open');
      document.body.classList.add('overflow-hidden');
    });
  }

  const closeSheet = () => {
    if (sheet) sheet.classList.remove('is-open');
    if (overlay) overlay.classList.remove('is-open');
    document.body.classList.remove('overflow-hidden');
  };

  if (closeBtn) closeBtn.addEventListener('click', closeSheet);

  const sizePillsContainer = document.getElementById('filter-size-pills');
  if (sizePillsContainer) {
    sizePillsContainer.querySelectorAll('.size-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        const size = pill.dataset.size;
        if (selectedFilterSize === size) {
          selectedFilterSize = null;
          pill.classList.remove('is-selected');
        } else {
          selectedFilterSize = size;
          sizePillsContainer.querySelectorAll('.size-pill').forEach(p => p.classList.remove('is-selected'));
          pill.classList.add('is-selected');
        }
      });
    });
  }

  if (applyBtn) {
    applyBtn.addEventListener('click', () => {
      const stockCheckbox = document.getElementById('filter-only-stock');
      onlyInStock = stockCheckbox ? stockCheckbox.checked : false;

      const minInput = document.getElementById('filter-min-price');
      minPrice = minInput && minInput.value ? Number(minInput.value) : null;

      const maxInput = document.getElementById('filter-max-price');
      maxPrice = maxInput && maxInput.value ? Number(maxInput.value) : null;

      closeSheet();
      applyAndRender();
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      onlyInStock = false;
      selectedFilterSize = null;
      minPrice = null;
      maxPrice = null;
      resetFilterFormInputs();
      closeSheet();
      applyAndRender();
    });
  }
}

function resetFilterFormInputs() {
  const stockCheckbox = document.getElementById('filter-only-stock');
  if (stockCheckbox) stockCheckbox.checked = false;

  const minInput = document.getElementById('filter-min-price');
  if (minInput) minInput.value = '';

  const maxInput = document.getElementById('filter-max-price');
  if (maxInput) maxInput.value = '';

  const sizePills = document.querySelectorAll('#filter-size-pills .size-pill');
  sizePills.forEach(p => p.classList.remove('is-selected'));
}
