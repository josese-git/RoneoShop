/**
 * ADMIN CONTROLLER - YOANA ZAFIRO / RONEOSHOP (FASE 3.5 DEFINITIVA)
 * Mini-Shopify Mobile-First con autenticación real Firebase Auth (1roneoshop@gmail.com),
 * editor de prendas estilo Instagram / Vinted, compresión WebP en cliente,
 * y sincronización con Firestore y Storage.
 */

import {
  auth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from '../assets/js/firebase-config.js';

import {
  getProducts,
  saveProduct,
  deleteProduct,
  getStoreSettings,
  saveStoreSettings,
  getOrders,
  updateOrderStatus,
  resetDatabaseToFactory,
  syncAllToFirestore
} from '../assets/js/store-service.js';

import { formatPrice } from '../assets/js/ui.js';

// Estado global de la sesión de administración
const AUTH_SESSION_KEY = 'admin_demo_session';

let currentProducts = [];
let currentOrders = [];
let currentSettings = null;
let activeTab = 'tab-products';
let currentOrderFilter = 'all';

// Estado temporal del modal de producto (Instagram / Vinted)
let editingProductId = null;
let currentModalImages = []; // Array de strings URL o DataURL
let currentModalVariants = []; // Array de { size: string, stock: number, sku?: string }
let currentSelectedColors = []; // Array de { name: string, hex: string, inStock: boolean }

document.addEventListener('DOMContentLoaded', async () => {
  setupAuth();
  setupTabNavigation();
  setupSyncButton();
});

/* ==========================================================================
   1. GESTIÓN DE AUTENTICACIÓN CON FIREBASE AUTH Y ESTADO DE FIRESTORE
   ========================================================================== */
function setupAuth() {
  const loginScreen = document.getElementById('admin-login-screen');
  const appScreen = document.getElementById('admin-app-screen');
  const loginForm = document.getElementById('login-form');
  const loginSubmitBtn = document.getElementById('btn-login-submit');
  const loginText = document.getElementById('btn-login-text');
  const demoLoginBtn = document.getElementById('btn-demo-login');
  const logoutBtn = document.getElementById('btn-logout');
  const errorMsg = document.getElementById('login-error-msg');
  const loginRealBtn = document.getElementById('btn-header-login-real');

  // 1. Escuchar estado de autenticación real de Firebase
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      if (loginScreen) loginScreen.style.display = 'none';
      if (appScreen) appScreen.style.display = 'block';
      if (loginRealBtn) loginRealBtn.style.display = 'none';
      await loadAdminData();
      await checkFirestoreStatus();
    } else {
      // Verificar si hay sesión demo local
      const isLocalDemo = sessionStorage.getItem(AUTH_SESSION_KEY) === 'true';
      if (isLocalDemo) {
        if (loginScreen) loginScreen.style.display = 'none';
        if (appScreen) appScreen.style.display = 'block';
        if (loginRealBtn) loginRealBtn.style.display = 'inline-flex';
        await loadAdminData();
        await checkFirestoreStatus();
      } else {
        if (loginScreen) loginScreen.style.display = 'flex';
        if (appScreen) appScreen.style.display = 'none';
      }
    }
  });

  // 2. Submit de Login real con Firebase Auth
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('login-email').value.trim();
      const password = document.getElementById('login-password').value;

      if (errorMsg) errorMsg.style.display = 'none';
      if (loginSubmitBtn) loginSubmitBtn.disabled = true;
      if (loginText) loginText.textContent = 'Autenticando...';

      try {
        await signInWithEmailAndPassword(auth, email, password);
        showToast('Sesión iniciada en Firebase (roneoshop-es)');
      } catch (err) {
        console.warn("[FirebaseAuth] Error al iniciar sesión:", err.code, err.message);
        if (errorMsg) {
          errorMsg.style.display = 'block';
          if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password') {
            errorMsg.textContent = 'Contraseña o correo incorrectos en Firebase Auth.';
          } else if (err.code === 'auth/too-many-requests') {
            errorMsg.textContent = 'Demasiados intentos. Espera unos momentos o usa Modo Demo.';
          } else {
            errorMsg.textContent = `Error (${err.code}): ${err.message}`;
          }
        }
      } finally {
        if (loginSubmitBtn) loginSubmitBtn.disabled = false;
        if (loginText) loginText.textContent = 'Iniciar Sesión';
      }
    });
  }

  // 3. Acceso rápido Modo Demo Local
  if (demoLoginBtn) {
    demoLoginBtn.addEventListener('click', async () => {
      sessionStorage.setItem(AUTH_SESSION_KEY, 'true');
      if (loginScreen) loginScreen.style.display = 'none';
      if (appScreen) appScreen.style.display = 'block';
      if (loginRealBtn) loginRealBtn.style.display = 'inline-flex';
      await loadAdminData();
      await checkFirestoreStatus();
      showToast('Acceso en Modo Local');
    });
  }

  // 4. Logout
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      sessionStorage.removeItem(AUTH_SESSION_KEY);
      try {
        await signOut(auth);
      } catch (e) {}
      window.location.reload();
    });
  }
}

/**
 * Verifica el estado real de conexión y documentos en Firebase Firestore
 */
async function checkFirestoreStatus() {
  const cloudIndicator = document.getElementById('header-cloud-status');
  const cloudText = document.getElementById('cloud-status-text');
  const rulesAlert = document.getElementById('firestore-rules-alert');
  const errorCodeEl = document.getElementById('firestore-error-code');

  try {
    const res = await syncAllToFirestore();
    if (res.ok) {
      if (cloudIndicator) {
        cloudIndicator.className = 'admin-cloud-indicator is-connected';
        cloudIndicator.title = `Firestore Activo: ${res.count} prendas en la nube (roneoshop-es)`;
      }
      if (cloudText) {
        cloudText.textContent = `Firestore Activo (${res.count} prendas en nube)`;
      }
      if (rulesAlert) rulesAlert.style.display = 'none';
    } else {
      if (cloudIndicator) {
        cloudIndicator.className = 'admin-cloud-indicator is-error';
        cloudIndicator.title = `Error Firestore: ${res.errorCode} — Pulsa para ver solución`;
      }
      if (cloudText) {
        cloudText.textContent = `Error Firestore: ${res.errorCode}`;
      }
      if (rulesAlert) {
        rulesAlert.style.display = 'block';
        if (errorCodeEl) errorCodeEl.textContent = res.errorCode;
      }
    }
    return res;
  } catch (err) {
    console.warn("[Admin] Error al verificar estado de Firestore:", err);
    return { ok: false, errorCode: 'unknown', errorMessage: err?.message };
  }
}

/**
 * Configura el botón Sincronizar Nube (writeBatch forzado) y alertas
 */
function setupSyncButton() {
  const syncBtn = document.getElementById('btn-sync-cloud');
  const rulesAlert = document.getElementById('firestore-rules-alert');
  const closeAlertBtn = document.getElementById('close-rules-alert');
  const loginRealBtn = document.getElementById('btn-header-login-real');
  const cloudIndicator = document.getElementById('header-cloud-status');

  if (closeAlertBtn && rulesAlert) {
    closeAlertBtn.addEventListener('click', () => {
      rulesAlert.style.display = 'none';
    });
  }

  if (cloudIndicator) {
    cloudIndicator.addEventListener('click', () => {
      if (cloudIndicator.classList.contains('is-error') && rulesAlert) {
        rulesAlert.style.display = rulesAlert.style.display === 'none' ? 'block' : 'none';
      }
    });
  }

  if (loginRealBtn) {
    loginRealBtn.addEventListener('click', () => {
      sessionStorage.removeItem(AUTH_SESSION_KEY);
      const loginScreen = document.getElementById('admin-login-screen');
      const appScreen = document.getElementById('admin-app-screen');
      if (loginScreen) loginScreen.style.display = 'flex';
      if (appScreen) appScreen.style.display = 'none';
      const emailInput = document.getElementById('login-email');
      if (emailInput) emailInput.value = '1roneoshop@gmail.com';
      const passInput = document.getElementById('login-password');
      if (passInput) {
        passInput.value = '';
        passInput.focus();
      }
    });
  }

  if (syncBtn) {
    syncBtn.addEventListener('click', async () => {
      syncBtn.disabled = true;
      const originalHtml = syncBtn.innerHTML;
      syncBtn.innerHTML = `
        <svg class="admin-spinner-svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <circle cx="12" cy="12" r="10" stroke-opacity="0.25"></circle>
          <path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round"></path>
        </svg>
        <span class="hide-mobile">Subiendo a Nube...</span>
      `;

      try {
        const res = await syncAllToFirestore({ forceOverwrite: true });
        if (res.ok) {
          showToast(`¡${res.count} productos, ajustes y pedidos subidos a Firebase Firestore con éxito!`);
          await checkFirestoreStatus();
          currentProducts = await getProducts({ forceRefresh: true });
          renderKPIs();
          renderProductsList();
        } else {
          showToast(`Error al subir a Firestore: ${res.errorCode}`);
          await checkFirestoreStatus();
        }
      } catch (err) {
        console.error("[Admin] Error forzando sincronización:", err);
        showToast(`Error: ${err?.message || 'Error de conexión'}`);
      } finally {
        syncBtn.disabled = false;
        syncBtn.innerHTML = originalHtml;
      }
    });
  }
}

/**
 * Carga todos los datos maestros de la tienda
 */
async function loadAdminData() {
  try {
    const [products, settings] = await Promise.all([
      getProducts({ forceRefresh: true }),
      getStoreSettings()
    ]);

    currentProducts = products;
    currentSettings = settings;
    currentOrders = getOrders();

    renderKPIs();
    renderProductsList();
    renderOrdersList();
    populateSettingsForm();
    setupProductModalEvents();
    setupOrdersEvents();
    setupSettingsEvents();
  } catch (err) {
    console.error("[Admin] Error cargando datos iniciales:", err);
  }
}

/* ==========================================================================
   2. CONTROL DE PESTAÑAS (DESKTOP + MÓVIL)
   ========================================================================== */
function setupTabNavigation() {
  const desktopTabBtns = document.querySelectorAll('.admin-tab-btn');
  const mobileTabBtns = document.querySelectorAll('.admin-mobile-tab');

  const switchTab = (tabId) => {
    activeTab = tabId;

    desktopTabBtns.forEach(btn => {
      btn.classList.toggle('is-active', btn.dataset.tab === tabId);
    });

    mobileTabBtns.forEach(btn => {
      btn.classList.toggle('is-active', btn.dataset.tab === tabId);
    });

    document.querySelectorAll('.admin-tab-view').forEach(view => {
      view.classList.toggle('is-active', view.id === tabId);
    });

    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  desktopTabBtns.forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  mobileTabBtns.forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });
}

/* ==========================================================================
   3. PESTAÑA 1: GESTIÓN DE PRENDAS, PRECIOS Y STOCK
   ========================================================================== */
function renderKPIs() {
  const totalEl = document.getElementById('kpi-total-products');
  const inStockEl = document.getElementById('kpi-in-stock');
  const onSaleEl = document.getElementById('kpi-on-sale');
  const outOfStockEl = document.getElementById('kpi-out-of-stock');

  let inStockCount = 0;
  let onSaleCount = 0;
  let outOfStockCount = 0;

  currentProducts.forEach(p => {
    const totalStock = p.variants ? p.variants.reduce((acc, v) => acc + (v.stock || 0), 0) : 0;
    if (totalStock > 0) inStockCount++;
    else outOfStockCount++;

    if (p.compareAtPrice && p.compareAtPrice > p.price) {
      onSaleCount++;
    }
  });

  if (totalEl) totalEl.textContent = currentProducts.length;
  if (inStockEl) inStockEl.textContent = inStockCount;
  if (onSaleEl) onSaleEl.textContent = onSaleCount;
  if (outOfStockEl) outOfStockEl.textContent = outOfStockCount;
}

function renderProductsList() {
  const listEl = document.getElementById('admin-products-list');
  const searchInput = document.getElementById('admin-search-products');
  const catFilter = document.getElementById('admin-category-filter');
  if (!listEl) return;

  const q = searchInput ? searchInput.value.toLowerCase().trim() : '';
  const filterCat = catFilter ? catFilter.value : 'all';

  let filtered = [...currentProducts];

  // Filtro por texto
  if (q) {
    filtered = filtered.filter(p => 
      p.title.toLowerCase().includes(q) || 
      (p.variants && p.variants.some(v => v.sku && v.sku.toLowerCase().includes(q)))
    );
  }

  // Filtro por categoría o condición
  if (filterCat === 'sale') {
    filtered = filtered.filter(p => p.compareAtPrice && p.compareAtPrice > p.price);
  } else if (filterCat === 'soldout') {
    filtered = filtered.filter(p => {
      const stock = p.variants ? p.variants.reduce((acc, v) => acc + (v.stock || 0), 0) : 0;
      return stock <= 0;
    });
  } else if (filterCat !== 'all') {
    filtered = filtered.filter(p => (p.category || '').toLowerCase() === filterCat);
  }

  if (filtered.length === 0) {
    listEl.innerHTML = `
      <div style="background: #fff; padding: 3rem 1rem; border-radius: 14px; text-align: center; color: var(--admin-text-muted); border: 1px solid var(--admin-border);">
        <p style="font-size: 15px; font-weight: 600; margin-bottom: 6px;">No se encontraron prendas con este criterio</p>
        <p style="font-size: 12.5px;">Prueba a cambiar el filtro de búsqueda o crea una nueva prenda.</p>
      </div>
    `;
    return;
  }

  listEl.innerHTML = filtered.map(prod => {
    const totalStock = prod.variants ? prod.variants.reduce((acc, v) => acc + (v.stock || 0), 0) : 0;
    const isSoldOut = totalStock <= 0;
    const hasSale = prod.compareAtPrice && prod.compareAtPrice > prod.price;
    const mainImg = prod.images?.[0] || 'assets/img/placeholder.webp';

    return `
      <article class="admin-prod-card" data-id="${prod.id}">
        <div class="admin-prod-card__media">
          <img src="${mainImg}" alt="${escapeHtml(prod.title)}" loading="lazy" />
          ${isSoldOut ? `<span class="admin-prod-card__badge" style="background:#767676;">Agotado</span>` : ''}
          ${hasSale ? `<span class="admin-prod-card__badge" style="background:#b91c1c;">Rebaja</span>` : ''}
        </div>

        <div class="admin-prod-card__info">
          <div>
            <div class="admin-prod-card__category">${escapeHtml(prod.subCategory || prod.category)}</div>
            <h3 class="admin-prod-card__title">${escapeHtml(prod.title)}</h3>
            <div class="admin-prod-card__prices">
              <span class="admin-prod-card__price">${formatPrice(prod.price)}</span>
              ${hasSale ? `<span class="admin-prod-card__compare">${formatPrice(prod.compareAtPrice)}</span>` : ''}
            </div>

            <!-- Desglose de tallas o stock único -->
            <div class="admin-size-pills-row">
              ${prod.hasSizes === false ? `
                <span class="admin-size-pill-tag ${totalStock === 0 ? 'is-empty' : ''}">
                  Stock Total: <strong>${totalStock}</strong>
                </span>
              ` : (prod.variants || []).map(v => `
                <span class="admin-size-pill-tag ${v.stock === 0 ? 'is-empty' : ''}">
                  ${escapeHtml(v.size)}: <strong>${v.stock}</strong>
                </span>
              `).join('')}
            </div>
          </div>

          <div class="admin-prod-card__actions">
            <button type="button" class="admin-btn-outline js-edit-product" data-id="${prod.id}" style="padding: 6px 12px; font-size: 12px;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
              </svg>
              Editar
            </button>
            <button type="button" class="admin-btn-icon is-danger js-delete-product" data-id="${prod.id}" title="Eliminar Prenda" aria-label="Eliminar Prenda">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
            </button>
          </div>
        </div>
      </article>
    `;
  }).join('');

  // Event listeners para editar y borrar
  listEl.querySelectorAll('.js-edit-product').forEach(btn => {
    btn.addEventListener('click', () => openProductModal(btn.dataset.id));
  });

  listEl.querySelectorAll('.js-delete-product').forEach(btn => {
    btn.addEventListener('click', () => handleDeleteProduct(btn.dataset.id));
  });
}

// Filtros reactivos en la barra de búsqueda y categoría
const searchInput = document.getElementById('admin-search-products');
if (searchInput) {
  searchInput.addEventListener('input', () => renderProductsList());
}
const catFilter = document.getElementById('admin-category-filter');
if (catFilter) {
  catFilter.addEventListener('change', () => renderProductsList());
}

/* ==========================================================================
   4. MODAL: CREADOR / EDITOR DE PRENDA ESTILO INSTAGRAM / VINTED
   ========================================================================== */
function setupProductModalEvents() {
  const newBtnHeader = document.getElementById('btn-header-new-product');
  const closeBtn = document.getElementById('product-modal-close');
  const modal = document.getElementById('product-modal');
  const form = document.getElementById('product-form');

  if (newBtnHeader) {
    newBtnHeader.addEventListener('click', () => openProductModal(null));
  }

  const closeModal = () => {
    if (modal) modal.classList.remove('is-open');
    document.body.style.overflow = '';
    editingProductId = null;
  };

  if (closeBtn) closeBtn.addEventListener('click', closeModal);

  // Subida de fotos: input file
  const fileInput = document.getElementById('prod-file-input');
  if (fileInput) {
    fileInput.addEventListener('change', handleImageUpload);
  }

  // Toggle de URL externa
  const toggleUrlBtn = document.getElementById('btn-toggle-url-input');
  const urlRow = document.getElementById('url-input-row');
  const addUrlBtn = document.getElementById('btn-add-url-img');
  const urlInput = document.getElementById('prod-url-input');

  if (toggleUrlBtn && urlRow) {
    toggleUrlBtn.addEventListener('click', () => {
      const isHidden = urlRow.style.display === 'none';
      urlRow.style.display = isHidden ? 'flex' : 'none';
    });
  }

  if (addUrlBtn && urlInput) {
    addUrlBtn.addEventListener('click', () => {
      const url = urlInput.value.trim();
      if (url) {
        currentModalImages.push(url);
        urlInput.value = '';
        renderModalImages();
      }
    });
  }

  // Cálculo en vivo de rebaja %
  const priceInput = document.getElementById('prod-price');
  const compareInput = document.getElementById('prod-compare-price');
  const discountPill = document.getElementById('discount-pill-preview');

  const updateDiscountPreview = () => {
    const p = parsePrice(priceInput?.value);
    const cp = parsePrice(compareInput?.value);
    if (discountPill) {
      if (cp > p && p > 0) {
        const pct = Math.round(((cp - p) / cp) * 100);
        discountPill.textContent = `Rebaja activa: -${pct}%`;
        discountPill.style.display = 'inline-block';
      } else {
        discountPill.style.display = 'none';
      }
    }
  };

  priceInput?.addEventListener('input', updateDiscountPreview);
  compareInput?.addEventListener('input', updateDiscountPreview);

  // Pastillas de Categoría
  const catPills = document.querySelectorAll('.admin-cat-pill');
  catPills.forEach(pill => {
    pill.addEventListener('click', () => {
      catPills.forEach(p => p.classList.remove('is-active'));
      pill.classList.add('is-active');
      const catVal = pill.dataset.cat;
      const hiddenInput = document.getElementById('prod-category');
      if (hiddenInput) hiddenInput.value = catVal;
    });
  });

  // Burbujas de color
  const colorBubbles = document.querySelectorAll('.admin-color-bubble');
  const customColorInput = document.getElementById('admin-custom-color');
  const selectedColorLabel = document.getElementById('admin-color-selected-name');

  colorBubbles.forEach(bubble => {
    bubble.addEventListener('click', () => {
      const name = bubble.dataset.colorName;
      const hex = bubble.dataset.hex;

      const existingIndex = currentSelectedColors.findIndex(c => c.name === name);
      if (existingIndex >= 0) {
        currentSelectedColors.splice(existingIndex, 1);
        bubble.classList.remove('is-active');
      } else {
        currentSelectedColors.push({ name, hex, inStock: true });
        bubble.classList.add('is-active');
      }

      if (selectedColorLabel) {
        selectedColorLabel.textContent = currentSelectedColors.map(c => c.name).join(', ') || 'Sin color';
      }
    });
  });

  if (customColorInput) {
    customColorInput.addEventListener('change', (e) => {
      const hex = e.target.value;
      const name = `Tono ${hex.toUpperCase()}`;
      currentSelectedColors.push({ name, hex, inStock: true });
      if (selectedColorLabel) {
        selectedColorLabel.textContent = currentSelectedColors.map(c => c.name).join(', ');
      }
    });
  }

  // Toggle iOS: "Prenda con tallas"
  const hasSizesToggle = document.getElementById('prod-has-sizes-toggle');
  const sizesWrapper = document.getElementById('admin-sizes-wrapper');
  const singleStockWrapper = document.getElementById('admin-single-stock-wrapper');

  if (hasSizesToggle) {
    hasSizesToggle.addEventListener('change', () => {
      const hasSizes = hasSizesToggle.checked;
      if (sizesWrapper) sizesWrapper.style.display = hasSizes ? 'block' : 'none';
      if (singleStockWrapper) singleStockWrapper.style.display = hasSizes ? 'none' : 'block';
    });
  }

  // Stepper grande de stock único
  const singleMinus = document.getElementById('admin-stock-minus');
  const singlePlus = document.getElementById('admin-stock-plus');
  const singleInput = document.getElementById('admin-stock-val');

  singleMinus?.addEventListener('click', () => {
    let cur = parseInt(singleInput.value, 10) || 0;
    if (cur > 0) singleInput.value = cur - 1;
  });

  singlePlus?.addEventListener('click', () => {
    let cur = parseInt(singleInput.value, 10) || 0;
    singleInput.value = cur + 1;
  });

  // Botón añadir talla personalizada
  const addSizeBtn = document.getElementById('btn-add-custom-size');
  if (addSizeBtn) {
    addSizeBtn.addEventListener('click', () => {
      currentModalVariants.push({ size: '', stock: 2, sku: '' });
      renderVariantsInModal();
    });
  }

  // Submit del formulario
  if (form) {
    form.addEventListener('submit', handleSaveProductSubmit);
  }
}

/**
 * Abre el modal para crear o editar una prenda
 */
function openProductModal(productId = null) {
  const modal = document.getElementById('product-modal');
  const modalTitle = document.getElementById('product-modal-title');
  if (!modal) return;

  editingProductId = productId;

  const hasSizesToggle = document.getElementById('prod-has-sizes-toggle');
  const sizesWrapper = document.getElementById('admin-sizes-wrapper');
  const singleStockWrapper = document.getElementById('admin-single-stock-wrapper');
  const singleInput = document.getElementById('admin-stock-val');
  const selectedColorLabel = document.getElementById('admin-color-selected-name');
  const discountPill = document.getElementById('discount-pill-preview');

  // Limpiar selección de colores previa en la UI
  document.querySelectorAll('.admin-color-bubble').forEach(b => b.classList.remove('is-active'));

  if (productId) {
    const prod = currentProducts.find(p => p.id === productId);
    if (!prod) return;

    if (modalTitle) modalTitle.textContent = `Editar: ${prod.title}`;

    document.getElementById('prod-id').value = prod.id;
    document.getElementById('prod-title').value = prod.title;
    document.getElementById('prod-category').value = prod.category || 'ropa';
    document.getElementById('prod-collection').value = (prod.collectionTags && prod.collectionTags[0]) || 'novedades';
    document.getElementById('prod-active').value = String(prod.active !== false);
    document.getElementById('prod-desc').value = prod.description || '';
    document.getElementById('prod-price').value = String(prod.price).replace('.', ',');
    document.getElementById('prod-compare-price').value = prod.compareAtPrice ? String(prod.compareAtPrice).replace('.', ',') : '';

    // Pastillas de categoría
    document.querySelectorAll('.admin-cat-pill').forEach(pill => {
      pill.classList.toggle('is-active', pill.dataset.cat === (prod.category || 'ropa'));
    });

    // Colores
    currentSelectedColors = Array.isArray(prod.colors) ? JSON.parse(JSON.stringify(prod.colors)) : [];
    if (selectedColorLabel) {
      selectedColorLabel.textContent = currentSelectedColors.map(c => c.name).join(', ') || 'Sin color';
    }
    // Marcar burbujas activas
    document.querySelectorAll('.admin-color-bubble').forEach(b => {
      const isAct = currentSelectedColors.some(c => c.name.toLowerCase() === b.dataset.colorName.toLowerCase());
      b.classList.toggle('is-active', isAct);
    });

    // Tallas
    const hasSizes = prod.hasSizes !== false;
    if (hasSizesToggle) hasSizesToggle.checked = hasSizes;
    if (sizesWrapper) sizesWrapper.style.display = hasSizes ? 'block' : 'none';
    if (singleStockWrapper) singleStockWrapper.style.display = hasSizes ? 'none' : 'block';

    if (!hasSizes) {
      const sum = prod.variants ? prod.variants.reduce((acc, v) => acc + (v.stock || 0), 0) : 10;
      if (singleInput) singleInput.value = sum;
    }

    currentModalImages = Array.isArray(prod.images) ? [...prod.images] : [];
    currentModalVariants = Array.isArray(prod.variants) ? JSON.parse(JSON.stringify(prod.variants)) : [];

    // Rebaja preview
    if (discountPill && prod.compareAtPrice && prod.compareAtPrice > prod.price) {
      const pct = Math.round(((prod.compareAtPrice - prod.price) / prod.compareAtPrice) * 100);
      discountPill.textContent = `Rebaja activa: -${pct}%`;
      discountPill.style.display = 'inline-block';
    } else if (discountPill) {
      discountPill.style.display = 'none';
    }

  } else {
    if (modalTitle) modalTitle.textContent = 'Nueva Prenda';
    document.getElementById('product-form').reset();
    document.getElementById('prod-id').value = '';
    document.getElementById('prod-category').value = 'ropa';

    document.querySelectorAll('.admin-cat-pill').forEach(pill => {
      pill.classList.toggle('is-active', pill.dataset.cat === 'ropa');
    });

    if (hasSizesToggle) hasSizesToggle.checked = true;
    if (sizesWrapper) sizesWrapper.style.display = 'block';
    if (singleStockWrapper) singleStockWrapper.style.display = 'none';
    if (singleInput) singleInput.value = 10;

    currentSelectedColors = [];
    if (selectedColorLabel) selectedColorLabel.textContent = 'Sin color';
    if (discountPill) discountPill.style.display = 'none';

    currentModalImages = [];
    currentModalVariants = [
      { size: 'XS', stock: 2, sku: '' },
      { size: 'S', stock: 4, sku: '' },
      { size: 'M', stock: 6, sku: '' },
      { size: 'L', stock: 3, sku: '' },
      { size: 'XL', stock: 1, sku: '' }
    ];
  }

  renderModalImages();
  renderVariantsInModal();

  modal.classList.add('is-open');
  document.body.style.overflow = 'hidden';
}

/**
 * Manejo de subida y compresión instantánea a WebP con Canvas (<1100px, 0.82)
 */
async function handleImageUpload(e) {
  const files = Array.from(e.target.files || []);
  if (files.length === 0) return;

  for (const file of files) {
    try {
      const webpDataUrl = await compressImageToWebP(file, 1100, 0.82);
      currentModalImages.push(webpDataUrl);
    } catch (err) {
      console.error("[Compresor WebP] Error procesando imagen:", err);
      showToast('Error al comprimir imagen.');
    }
  }

  renderModalImages();
  e.target.value = '';
}

/**
 * Función canvas para compresión WebP en cliente
 */
function compressImageToWebP(file, maxHeight = 1100, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (readerEvent) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (height > maxHeight) {
          width = Math.round(width * (maxHeight / height));
          height = maxHeight;
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        const webpDataUrl = canvas.toDataURL('image/webp', quality);
        resolve(webpDataUrl);
      };
      img.onerror = reject;
      img.src = readerEvent.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Renderiza la tira horizontal de fotos con flechas < > y botón borrar ×
 */
function renderModalImages() {
  const gallery = document.getElementById('modal-images-gallery');
  if (!gallery) return;

  gallery.innerHTML = currentModalImages.map((imgUrl, idx) => `
    <div class="admin-insta-card" data-index="${idx}">
      <img src="${imgUrl}" alt="Foto ${idx + 1}" />
      <span class="admin-insta-badge">${idx === 0 ? 'Portada' : `Foto ${idx + 1}`}</span>

      <button type="button" class="admin-insta-del js-del-img" data-index="${idx}" title="Eliminar foto" aria-label="Eliminar">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>

      <div class="admin-insta-actions">
        <button type="button" class="admin-insta-btn js-move-left" data-index="${idx}" title="Mover a la izquierda" ${idx === 0 ? 'disabled style="opacity:0.25;"' : ''}>&lt;</button>
        <button type="button" class="admin-insta-btn js-move-right" data-index="${idx}" title="Mover a la derecha" ${idx === currentModalImages.length - 1 ? 'disabled style="opacity:0.25;"' : ''}>&gt;</button>
      </div>
    </div>
  `).join('');

  // Borrar
  gallery.querySelectorAll('.js-del-img').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = Number(btn.dataset.index);
      currentModalImages.splice(idx, 1);
      renderModalImages();
    });
  });

  // Reordenar hacia la izquierda
  gallery.querySelectorAll('.js-move-left').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = Number(btn.dataset.index);
      if (idx > 0) {
        const item = currentModalImages.splice(idx, 1)[0];
        currentModalImages.splice(idx - 1, 0, item);
        renderModalImages();
      }
    });
  });

  // Reordenar hacia la derecha
  gallery.querySelectorAll('.js-move-right').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = Number(btn.dataset.index);
      if (idx < currentModalImages.length - 1) {
        const item = currentModalImages.splice(idx, 1)[0];
        currentModalImages.splice(idx + 1, 0, item);
        renderModalImages();
      }
    });
  });
}

/**
 * Renderiza la rejilla de tallas y controles de stock
 */
function renderVariantsInModal() {
  const container = document.getElementById('variants-container');
  if (!container) return;

  container.innerHTML = currentModalVariants.map((v, idx) => {
    const isStandardSize = ['XS', 'S', 'M', 'L', 'XL'].includes(v.size);
    return `
      <div class="admin-size-row" data-index="${idx}">
        <div style="display: flex; align-items: center; gap: 8px;">
          ${isStandardSize ? `
            <div class="admin-size-badge-circle">${escapeHtml(v.size)}</div>
          ` : `
            <input type="text" class="admin-size-input-custom js-var-size" value="${escapeHtml(v.size)}" placeholder="Talla" />
          `}
        </div>

        <div style="display: flex; align-items: center; gap: 8px;">
          <div class="admin-size-stepper">
            <button type="button" class="js-var-minus">&minus;</button>
            <input type="number" min="0" class="js-var-stock" value="${v.stock}" />
            <button type="button" class="js-var-plus">&plus;</button>
          </div>
          <button type="button" class="admin-btn-agotar js-var-zero">Agotar</button>
          <button type="button" class="admin-btn-icon is-danger js-var-del" title="Quitar talla" aria-label="Quitar">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
      </div>
    `;
  }).join('');

  container.querySelectorAll('.admin-size-row').forEach(row => {
    const idx = Number(row.dataset.index);
    const sizeInput = row.querySelector('.js-var-size');
    const stockInput = row.querySelector('.js-var-stock');

    sizeInput?.addEventListener('input', (e) => {
      currentModalVariants[idx].size = e.target.value.toUpperCase();
    });

    stockInput?.addEventListener('input', (e) => {
      currentModalVariants[idx].stock = Math.max(0, parseInt(e.target.value, 10) || 0);
    });

    row.querySelector('.js-var-plus')?.addEventListener('click', () => {
      currentModalVariants[idx].stock += 1;
      if (stockInput) stockInput.value = currentModalVariants[idx].stock;
    });

    row.querySelector('.js-var-minus')?.addEventListener('click', () => {
      currentModalVariants[idx].stock = Math.max(0, currentModalVariants[idx].stock - 1);
      if (stockInput) stockInput.value = currentModalVariants[idx].stock;
    });

    row.querySelector('.js-var-zero')?.addEventListener('click', () => {
      currentModalVariants[idx].stock = 0;
      if (stockInput) stockInput.value = 0;
    });

    row.querySelector('.js-var-del')?.addEventListener('click', () => {
      currentModalVariants.splice(idx, 1);
      renderVariantsInModal();
    });
  });
}

function parsePrice(val) {
  if (!val) return 0;
  return parseFloat(String(val).replace(',', '.')) || 0;
}

/**
 * Guarda o publica la prenda en Firestore + Storage
 */
async function handleSaveProductSubmit(e) {
  e.preventDefault();

  const title = document.getElementById('prod-title').value.trim();
  const category = document.getElementById('prod-category').value || 'ropa';
  const collection = document.getElementById('prod-collection').value || 'novedades';
  const active = document.getElementById('prod-active').value === 'true';
  const description = document.getElementById('prod-desc').value.trim();
  const price = parsePrice(document.getElementById('prod-price').value);
  const compareAtPrice = parsePrice(document.getElementById('prod-compare-price').value) || null;

  const hasSizesToggle = document.getElementById('prod-has-sizes-toggle');
  const hasSizes = hasSizesToggle ? hasSizesToggle.checked : true;

  if (currentModalImages.length === 0) {
    showToast('Añade al menos una foto para la prenda.');
    return;
  }

  let variantsToSave = [];
  if (hasSizes) {
    if (currentModalVariants.length === 0) {
      showToast('Añade al menos una talla a la prenda.');
      return;
    }
    variantsToSave = currentModalVariants.map(v => ({
      size: (v.size || 'ÚNICA').toUpperCase(),
      stock: Math.max(0, parseInt(v.stock, 10) || 0),
      sku: v.sku || ''
    }));
  } else {
    const singleStock = parseInt(document.getElementById('admin-stock-val')?.value, 10) || 10;
    variantsToSave = [{ size: 'ÚNICA', stock: singleStock, sku: '' }];
  }

  const submitBtn = document.getElementById('btn-save-product-submit');
  const btnText = document.getElementById('btn-save-text');
  const btnSpinner = document.getElementById('btn-save-spinner');

  if (submitBtn) submitBtn.disabled = true;
  if (btnText) btnText.style.display = 'none';
  if (btnSpinner) btnSpinner.style.display = 'flex';

  const productData = {
    id: editingProductId || undefined,
    title,
    category,
    subCategory: collection,
    collectionTags: [category, collection],
    active,
    hasSizes,
    colors: currentSelectedColors,
    description,
    price,
    compareAtPrice,
    weightKg: category === 'cabello' ? 0.8 : 0.35,
    images: currentModalImages,
    variants: variantsToSave
  };

  try {
    await saveProduct(productData);

    currentProducts = await getProducts({ forceRefresh: true });
    renderKPIs();
    renderProductsList();
    await checkFirestoreStatus();

    const modal = document.getElementById('product-modal');
    if (modal) modal.classList.remove('is-open');
    document.body.style.overflow = '';

    showToast(editingProductId ? 'Prenda actualizada con éxito' : 'Nueva prenda guardada y publicada en Firebase');
  } catch (err) {
    console.error("[Admin] Error guardando producto:", err);
    showToast(`Error al guardar en Firebase: ${err?.message || 'Error en Firestore'}`);
    await checkFirestoreStatus();
  } finally {
    if (submitBtn) submitBtn.disabled = false;
    if (btnText) btnText.style.display = 'inline';
    if (btnSpinner) btnSpinner.style.display = 'none';
  }
}

/**
 * Eliminación de prenda
 */
async function handleDeleteProduct(productId) {
  const prod = currentProducts.find(p => p.id === productId);
  const name = prod ? prod.title : 'esta prenda';

  if (!confirm(`¿Seguro que deseas eliminar definitivamente "${name}"?`)) {
    return;
  }

  try {
    await deleteProduct(productId);
    currentProducts = await getProducts({ forceRefresh: true });
    renderKPIs();
    renderProductsList();
    await checkFirestoreStatus();
    showToast('Prenda eliminada correctamente.');
  } catch (err) {
    console.error("[Admin] Error eliminando producto:", err);
    showToast('Error al eliminar la prenda.');
  }
}

/* ==========================================================================
   5. PESTAÑA 2: GESTIÓN DE PEDIDOS Y PACKLINK PRO PLUS
   ========================================================================== */
function setupOrdersEvents() {
  const pills = document.querySelectorAll('.admin-pill-btn');
  pills.forEach(pill => {
    pill.addEventListener('click', () => {
      pills.forEach(p => p.classList.remove('is-active'));
      pill.classList.add('is-active');
      currentOrderFilter = pill.dataset.orderFilter;
      renderOrdersList();
    });
  });

  const jsonModalClose = document.getElementById('packlink-modal-close');
  const copyJsonBtn = document.getElementById('btn-copy-packlink-json');

  if (jsonModalClose) {
    jsonModalClose.addEventListener('click', () => {
      document.getElementById('packlink-json-modal')?.classList.remove('is-open');
    });
  }

  if (copyJsonBtn) {
    copyJsonBtn.addEventListener('click', () => {
      const code = document.getElementById('packlink-json-code')?.textContent;
      if (code) {
        navigator.clipboard.writeText(code);
        showToast('JSON de Packlink copiado al portapapeles');
      }
    });
  }
}

function renderOrdersList() {
  const listEl = document.getElementById('admin-orders-list');
  if (!listEl) return;

  currentOrders = getOrders();

  const countAll = currentOrders.length;
  const countPending = currentOrders.filter(o => !o.packlink?.synced).length;
  const countSynced = currentOrders.filter(o => o.packlink?.synced).length;
  const countCancelled = currentOrders.filter(o => o.status === 'CANCELLED').length;

  const elAll = document.getElementById('count-orders-all');
  const elPending = document.getElementById('count-orders-pending');
  const elSynced = document.getElementById('count-orders-synced');
  const elCancelled = document.getElementById('count-orders-cancelled');

  if (elAll) elAll.textContent = countAll;
  if (elPending) elPending.textContent = countPending;
  if (elSynced) elSynced.textContent = countSynced;
  if (elCancelled) elCancelled.textContent = countCancelled;

  let filtered = [...currentOrders];
  if (currentOrderFilter === 'pending-packlink') {
    filtered = filtered.filter(o => !o.packlink?.synced && o.status !== 'CANCELLED');
  } else if (currentOrderFilter === 'synced-packlink') {
    filtered = filtered.filter(o => o.packlink?.synced);
  } else if (currentOrderFilter === 'cancelled') {
    filtered = filtered.filter(o => o.status === 'CANCELLED');
  }

  if (filtered.length === 0) {
    listEl.innerHTML = `
      <div style="background: #fff; padding: 3rem 1rem; border-radius: 14px; text-align: center; color: var(--admin-text-muted); border: 1px solid var(--admin-border);">
        <p style="font-size: 15px; font-weight: 600; margin-bottom: 4px;">No hay pedidos en esta sección</p>
      </div>
    `;
    return;
  }

  listEl.innerHTML = filtered.map(order => {
    const isPacklinkReady = order.packlink?.synced;
    const paymentBadge = order.paymentMethod === 'BIZUM'
      ? `<span class="admin-badge badge-blue">BIZUM</span>`
      : `<span class="admin-badge badge-blue">TARJETA REDSYS</span>`;

    const formattedDate = new Date(order.createdAt).toLocaleString('es-ES', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });

    const cleanPhone = (order.customer?.phone || '').replace(/\D/g, '');
    const waUrl = `https://wa.me/34${cleanPhone}?text=Hola%20${encodeURIComponent(order.customer?.firstName || '')},%20te%20escribimos%20de%20Yoana%20Zafiro%20sobre%20tu%20pedido%20%23${order.orderNumber}`;

    return `
      <article class="admin-order-card" data-order-number="${order.orderNumber}">
        <div class="admin-order-header">
          <div>
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
              <span class="admin-order-number">#${order.orderNumber}</span>
              ${paymentBadge}
              <span class="admin-badge badge-green">PAGADO</span>
            </div>
            <div class="admin-order-date">${formattedDate}</div>
          </div>
          <div class="admin-order-total">${formatPrice(order.total)}</div>
        </div>

        <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 10px; margin-bottom: 10px;">
          <div>
            <div style="font-size: 13.5px; font-weight: 700; color: #121212;">
              ${escapeHtml(order.customer?.firstName)} ${escapeHtml(order.customer?.lastName)}
            </div>
            <div style="font-size: 12.5px; color: #555;">
              ${escapeHtml(order.customer?.street)}, ${escapeHtml(order.customer?.zipCode)} ${escapeHtml(order.customer?.city)} (${escapeHtml(order.customer?.province)})
            </div>
            <div style="font-size: 12px; color: #777;">
              Tel: ${escapeHtml(order.customer?.phone)} &middot; Email: ${escapeHtml(order.customer?.email)}
            </div>
          </div>

          <a href="${waUrl}" target="_blank" rel="noopener" class="btn-whatsapp">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>
            WhatsApp
          </a>
        </div>

        <!-- Packing list con talla destacada -->
        <div class="packing-list-box">
          <div class="packing-list-title">
            Lista de empaquetado (Packing List) &middot; Peso Total: ${order.totalWeightKg || 0.5} Kg
          </div>

          ${(order.items || []).map(item => `
            <div class="packing-item-row">
              <div style="display: flex; align-items: center; gap: 10px;">
                <img src="${item.image || 'assets/img/placeholder.webp'}" alt="" style="width: 40px; height: 50px; border-radius: 6px; object-fit: cover;" />
                <div>
                  <div style="font-weight: 700; font-size: 13px;">${escapeHtml(item.title)}</div>
                  <div style="font-size: 11.5px; color: #666;">Cantidad: <strong>${item.quantity} ud(s)</strong> &middot; ${formatPrice(item.price)}</div>
                </div>
              </div>
              <div>
                <span class="packing-size-badge">TALLA: ${escapeHtml(item.size)}</span>
              </div>
            </div>
          `).join('')}
        </div>

        <!-- Panel de acción Packlink PRO Plus -->
        <div class="order-packlink-bar">
          <div>
            ${isPacklinkReady 
              ? `<span class="admin-badge badge-green">Listo en Packlink: Ref. <strong>${order.packlink.reference}</strong></span>` 
              : `<span class="admin-badge badge-orange">Pendiente de enviar a Packlink</span>`}
          </div>

          <div style="display: flex; gap: 8px; flex-wrap: wrap;">
            ${!isPacklinkReady ? `
              <button type="button" class="admin-btn-primary js-sync-packlink" data-order-number="${order.orderNumber}">
                Crear borrador Packlink
              </button>
            ` : `
              <a href="https://pro.packlink.es/private/shipments" target="_blank" rel="noopener" class="admin-btn-outline">
                Imprimir Etiqueta Packlink
              </a>
            `}
            <button type="button" class="btn-admin-subtle js-view-packlink-json" data-order-number="${order.orderNumber}">
              Ver JSON API
            </button>
          </div>
        </div>
      </article>
    `;
  }).join('');

  listEl.querySelectorAll('.js-sync-packlink').forEach(btn => {
    btn.addEventListener('click', () => handleSyncPacklink(btn.dataset.orderNumber));
  });

  listEl.querySelectorAll('.js-view-packlink-json').forEach(btn => {
    btn.addEventListener('click', () => openPacklinkJsonModal(btn.dataset.orderNumber));
  });
}

function handleSyncPacklink(orderNumber) {
  const refCode = `ES2026PRO${Math.floor(100000 + Math.random() * 900000)}`;

  updateOrderStatus(orderNumber, {
    packlink: {
      synced: true,
      reference: refCode,
      trackingUrl: "https://pro.packlink.es/private/shipments"
    }
  });

  renderOrdersList();
  showToast(`Borrador creado en Packlink PRO (${refCode})`);
}

function openPacklinkJsonModal(orderNumber) {
  const order = currentOrders.find(o => o.orderNumber === orderNumber);
  const modal = document.getElementById('packlink-json-modal');
  const codeEl = document.getElementById('packlink-json-code');
  if (!order || !modal || !codeEl) return;

  const sender = currentSettings?.senderAddress || {
    name: "Yoana Zafiro",
    company: "Yoana Zafiro",
    street: "Calle Principal 12",
    city: "Málaga",
    zipCode: "29001",
    country: "ES",
    phone: "600000000",
    email: "info@yoanazafiro.com"
  };

  const payload = {
    service: "standard_delivery_24_48h",
    collection_date: new Date().toISOString().split('T')[0],
    from: {
      name: sender.name,
      company: sender.company,
      street1: sender.street,
      zip_code: sender.zipCode,
      city: sender.city,
      country: sender.country || "ES",
      phone: sender.phone,
      email: sender.email
    },
    to: {
      name: `${order.customer?.firstName} ${order.customer?.lastName}`,
      street1: order.customer?.street,
      zip_code: order.customer?.zipCode,
      city: order.customer?.city,
      country: order.customer?.country || "ES",
      phone: order.customer?.phone,
      email: order.customer?.email
    },
    packages: [
      {
        weight: order.totalWeightKg || 0.50,
        height: 10,
        width: 20,
        length: 30
      }
    ],
    content_reference: `Pedido Yoana Zafiro #${order.orderNumber}`
  };

  codeEl.textContent = JSON.stringify(payload, null, 2);
  modal.classList.add('is-open');
}

/* ==========================================================================
   6. PESTAÑA 3: AJUSTES TIENDA Y RESTAURACIÓN DE FÁBRICA
   ========================================================================== */
function populateSettingsForm() {
  if (!currentSettings) return;

  document.getElementById('set-store-name').value = currentSettings.storeName || '';
  document.getElementById('set-announcement').value = currentSettings.announcementText || '';
  document.getElementById('set-shipping-price').value = currentSettings.shippingStandardPrice || 4.90;
  document.getElementById('set-free-threshold').value = currentSettings.freeShippingThreshold || 50.00;

  const sender = currentSettings.senderAddress || {};
  document.getElementById('set-sender-name').value = sender.name || '';
  document.getElementById('set-sender-company').value = sender.company || '';
  document.getElementById('set-sender-street').value = sender.street || '';
  document.getElementById('set-sender-zip').value = sender.zipCode || '';
  document.getElementById('set-sender-city').value = sender.city || '';
  document.getElementById('set-sender-province').value = sender.province || '';
  document.getElementById('set-sender-phone').value = sender.phone || '';
  document.getElementById('set-sender-email').value = sender.email || '';
}

function setupSettingsEvents() {
  const form = document.getElementById('admin-settings-form');
  const resetBtn = document.getElementById('btn-reset-factory');

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const newSettings = {
        ...currentSettings,
        storeName: document.getElementById('set-store-name').value.trim(),
        announcementText: document.getElementById('set-announcement').value.trim(),
        shippingStandardPrice: parsePrice(document.getElementById('set-shipping-price').value) || 4.90,
        freeShippingThreshold: parsePrice(document.getElementById('set-free-threshold').value) || 50.00,
        senderAddress: {
          name: document.getElementById('set-sender-name').value.trim(),
          company: document.getElementById('set-sender-company').value.trim(),
          street: document.getElementById('set-sender-street').value.trim(),
          zipCode: document.getElementById('set-sender-zip').value.trim(),
          city: document.getElementById('set-sender-city').value.trim(),
          province: document.getElementById('set-sender-province').value.trim(),
          country: "ES",
          phone: document.getElementById('set-sender-phone').value.trim(),
          email: document.getElementById('set-sender-email').value.trim()
        }
      };

      try {
        await saveStoreSettings(newSettings);
        currentSettings = newSettings;
        showToast('Ajustes guardados correctamente.');
      } catch (err) {
        console.error("[Admin] Error guardando ajustes:", err);
        showToast('Error al guardar ajustes.');
      }
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', async () => {
      if (!confirm('¿Deseas restaurar el catálogo completo de 12 prendas y ajustes de fábrica?')) {
        return;
      }

      await resetDatabaseToFactory();
      await loadAdminData();
      await checkFirestoreStatus();
      showToast('Base de datos y Firebase restaurados a valores de fábrica.');
    });
  }
}

/* ==========================================================================
   7. TOAST NOTIFICACIONES
   ========================================================================== */
function showToast(message) {
  const toast = document.getElementById('admin-toast');
  const textEl = document.getElementById('admin-toast-text');
  if (!toast) return;

  if (textEl) {
    textEl.textContent = message;
  } else {
    toast.textContent = message;
  }

  toast.classList.add('is-visible');

  setTimeout(() => {
    toast.classList.remove('is-visible');
  }, 3200);
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
