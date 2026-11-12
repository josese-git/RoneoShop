/**
 * ACCOUNT UI CONTROLLER - RONEO SHOP
 * Controlador de interfaz para la sección "Cuenta" (Modal / Drawer Editorial).
 * Soporta registro, inicio de sesión, recuperación de contraseña,
 * consulta de pedidos propios, favoritos reactivos, perfil editable y tracking en vivo.
 * Cero Emojis · 100% SVG · Coste 0,00€ Plan Blaze.
 */

import {
  onAuthUserChange,
  getActiveUser,
  registerCustomer,
  loginCustomer,
  logoutCustomer,
  requestPasswordReset,
  getCustomerProfile,
  updateCustomerProfile,
  getCustomerOrders,
  getCustomerFavorites,
  removeCustomerFavorite,
  getOrderTrackingInfo
} from './account-service.js';
import { formatPrice } from './ui.js';

let activeAccountTab = 'orders'; // 'orders', 'favorites', 'profile'
let currentAuthMode = 'login'; // 'login', 'register', 'forgot'
let cachedOrders = null;
let cachedFavorites = null;
let cachedProfile = null;

/**
 * Inicializa el controlador de cuenta y escucha cambios de auth
 */
export function initAccountUI() {
  onAuthUserChange(async (user) => {
    cachedOrders = null;
    cachedFavorites = null;
    cachedProfile = null;
    renderAccountModalContent();
  });
}

/**
 * Renderiza el contenido interno del modal según el estado de autenticación
 */
export async function renderAccountModalContent() {
  const modal = document.getElementById('account-preview-modal');
  if (!modal) return;

  const dialog = modal.querySelector('.editorial-modal__dialog');
  if (!dialog) return;

  const user = getActiveUser();

  if (!user) {
    dialog.innerHTML = renderAuthView();
    attachAuthEvents(dialog);
  } else {
    dialog.innerHTML = renderDashboardView(user);
    attachDashboardEvents(dialog, user);
    loadActiveTabData(dialog, user);
  }
}

/**
 * Vista de no autenticado (Login / Registro / Recuperación)
 */
function renderAuthView() {
  return `
    <button type="button" class="editorial-modal__close" data-action="close-account-modal" aria-label="Cerrar modal">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    </button>

    <div class="account-auth-container">
      <div class="account-header-branding">
        <div class="account-brand-icon">
          <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="8" r="4"></circle>
            <path d="M4 20c1.5-4 5-5 8-5s6.5 1 8 5"></path>
          </svg>
        </div>
        <h2 class="account-title">Mi Cuenta &middot; Roneo Shop</h2>
        <p class="account-subtitle">Accede a tus pedidos, prendas favoritas y datos de envío</p>
      </div>

      <div class="account-auth-switcher" role="tablist">
        <button type="button" class="account-switch-btn ${currentAuthMode === 'login' ? 'is-active' : ''}" data-auth-mode="login">
          Iniciar Sesión
        </button>
        <button type="button" class="account-switch-btn ${currentAuthMode === 'register' ? 'is-active' : ''}" data-auth-mode="register">
          Crear Cuenta
        </button>
      </div>

      <div id="account-auth-alert" class="account-alert" style="display: none;"></div>

      ${currentAuthMode === 'login' ? `
        <form id="account-login-form" class="account-form" novalidate>
          <div class="form-group">
            <label for="acc-login-email" class="form-label">Correo electrónico</label>
            <input type="email" id="acc-login-email" class="form-input" required autocomplete="email" placeholder="ejemplo@correo.es" />
          </div>
          <div class="form-group">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
              <label for="acc-login-pass" class="form-label" style="margin-bottom: 0;">Contraseña</label>
              <button type="button" id="btn-forgot-password-link" style="background: none; border: none; font-size: 11.5px; color: #7d5353; cursor: pointer; text-decoration: underline;">
                ¿Olvidaste tu contraseña?
              </button>
            </div>
            <input type="password" id="acc-login-pass" class="form-input" required autocomplete="current-password" placeholder="Tu contraseña" />
          </div>
          <button type="submit" id="btn-acc-login" class="btn-primary" style="width: 100%; margin-top: 6px;">
            Iniciar Sesión
          </button>
        </form>
      ` : currentAuthMode === 'register' ? `
        <form id="account-register-form" class="account-form" novalidate>
          <div class="form-group">
            <label for="acc-reg-name" class="form-label">Nombre y apellidos</label>
            <input type="text" id="acc-reg-name" class="form-input" required autocomplete="name" placeholder="Tu nombre completo" />
          </div>
          <div class="form-group">
            <label for="acc-reg-email" class="form-label">Correo electrónico</label>
            <input type="email" id="acc-reg-email" class="form-input" required autocomplete="email" placeholder="ejemplo@correo.es" />
          </div>
          <div class="form-group">
            <label for="acc-reg-pass" class="form-label">Contraseña (mínimo 6 caracteres)</label>
            <input type="password" id="acc-reg-pass" class="form-input" required minlength="6" autocomplete="new-password" placeholder="Crea una contraseña segura" />
          </div>
          <button type="submit" id="btn-acc-register" class="btn-primary" style="width: 100%; margin-top: 6px;">
            Crear mi Cuenta
          </button>
        </form>
      ` : `
        <form id="account-forgot-form" class="account-form" novalidate>
          <p style="font-size: 12.5px; color: #6e5a5a; margin-bottom: 12px; line-height: 1.5;">
            Introduce tu correo electrónico y te enviaremos un enlace oficial seguro para restablecer tu contraseña.
          </p>
          <div class="form-group">
            <label for="acc-forgot-email" class="form-label">Correo electrónico</label>
            <input type="email" id="acc-forgot-email" class="form-input" required placeholder="ejemplo@correo.es" />
          </div>
          <button type="submit" id="btn-acc-forgot" class="btn-primary" style="width: 100%; margin-top: 6px;">
            Enviar Enlace de Recuperación
          </button>
          <div style="text-align: center; margin-top: 12px;">
            <button type="button" id="btn-back-to-login" style="background: none; border: none; font-size: 12px; color: #4d2525; cursor: pointer; text-decoration: underline;">
              Volver a Iniciar Sesión
            </button>
          </div>
        </form>
      `}

      <div class="account-admin-link-box">
        <a href="admin/index.html" class="account-admin-link">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
          </svg>
          <span>Acceso Administración (/admin)</span>
        </a>
      </div>
    </div>
  `;
}

/**
 * Vista de usuario autenticado (Dashboard con Pedidos, Favoritos y Perfil)
 */
function renderDashboardView(user) {
  const email = user.email || '';
  const displayName = user.displayName || email.split('@')[0];

  return `
    <button type="button" class="editorial-modal__close" data-action="close-account-modal" aria-label="Cerrar modal">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    </button>

    <div class="account-dashboard-container">
      <!-- Cabecera de Usuario -->
      <div class="account-dashboard-header">
        <div class="account-avatar">
          <span>${displayName.charAt(0).toUpperCase()}</span>
        </div>
        <div class="account-user-meta">
          <div class="account-user-name">${displayName}</div>
          <div class="account-user-email">${email}</div>
        </div>
        <button type="button" id="btn-account-logout" class="btn-account-logout" title="Cerrar Sesión">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
            <polyline points="16 17 21 12 16 7"></polyline>
            <line x1="21" y1="12" x2="9" y2="12"></line>
          </svg>
          <span>Salir</span>
        </button>
      </div>

      <!-- Barra de Pestañas -->
      <div class="account-tabs-bar" role="tablist">
        <button type="button" class="account-tab-btn ${activeAccountTab === 'orders' ? 'is-active' : ''}" data-tab="orders">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75">
            <rect x="1" y="3" width="15" height="13" rx="1"></rect>
            <polygon points="16 8 20 8 23 11 23 16 16 16 8"></polygon>
            <circle cx="5.5" cy="18.5" r="2.5"></circle>
            <circle cx="18.5" cy="18.5" r="2.5"></circle>
          </svg>
          <span>Mis Pedidos</span>
        </button>

        <button type="button" class="account-tab-btn ${activeAccountTab === 'favorites' ? 'is-active' : ''}" data-tab="favorites">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
          </svg>
          <span>Favoritos</span>
        </button>

        <button type="button" class="account-tab-btn ${activeAccountTab === 'profile' ? 'is-active' : ''}" data-tab="profile">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75">
            <circle cx="12" cy="8" r="4"></circle>
            <path d="M4 20c1.5-4 5-5 8-5s6.5 1 8 5"></path>
          </svg>
          <span>Mis Datos</span>
        </button>
      </div>

      <!-- Contenedor del Contenido de Pestaña -->
      <div id="account-tab-content-area" class="account-tab-content">
        <div class="account-loading-spinner" style="text-align: center; padding: 2.5rem 0;">
          <div class="spinner-dot-pulse"></div>
          <p style="font-size: 12.5px; color: #8c7878; margin-top: 8px;">Cargando tus datos...</p>
        </div>
      </div>

      <!-- Pie con Enlace a Administración -->
      <div class="account-dashboard-footer">
        <a href="admin/index.html" class="account-admin-link">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
          </svg>
          <span>Panel de Administración (/admin)</span>
        </a>
      </div>
    </div>
  `;
}

/**
 * Carga el contenido de la pestaña activa (Pedidos, Favoritos o Datos)
 */
async function loadActiveTabData(dialog, user) {
  const contentArea = dialog.querySelector('#account-tab-content-area');
  if (!contentArea) return;

  if (activeAccountTab === 'orders') {
    if (!cachedOrders) {
      cachedOrders = await getCustomerOrders(user.uid);
    }
    renderOrdersTab(contentArea, cachedOrders);
  } else if (activeAccountTab === 'favorites') {
    if (!cachedFavorites) {
      cachedFavorites = await getCustomerFavorites(user.uid);
    }
    renderFavoritesTab(contentArea, cachedFavorites, user.uid);
  } else if (activeAccountTab === 'profile') {
    if (!cachedProfile) {
      cachedProfile = await getCustomerProfile(user.uid) || { email: user.email, displayName: user.displayName };
    }
    renderProfileTab(contentArea, cachedProfile, user.uid);
  }
}

/**
 * Pestaña Mis Pedidos
 */
function renderOrdersTab(container, orders) {
  if (!orders || orders.length === 0) {
    container.innerHTML = `
      <div class="account-empty-state">
        <div class="account-empty-icon">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
            <rect x="1" y="3" width="15" height="13" rx="1"></rect>
            <polygon points="16 8 20 8 23 11 23 16 16 16 8"></polygon>
            <circle cx="5.5" cy="18.5" r="2.5"></circle>
            <circle cx="18.5" cy="18.5" r="2.5"></circle>
          </svg>
        </div>
        <h3 class="account-empty-title">Aún no tienes pedidos</h3>
        <p class="account-empty-desc">Cuando realices compras en Roneo Shop podrás ver aquí el desglose completo, estado de envío y seguimiento en tiempo real.</p>
        <a href="collection.html?cat=todos" class="btn-primary" style="display: inline-block; padding: 10px 20px; font-size: 13px;">
          Descubrir Catálogo
        </a>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="account-orders-list">
      ${orders.map(order => {
        const dateStr = order.createdAt ? new Date(order.createdAt).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Reciente';
        const isSimulated = order.isTest || order.paymentStatus === 'SIMULATED';
        const hasTrackingRef = Boolean(order.packlinkReference && order.packlinkReference !== 'PENDIENTE-ENVIO' && order.packlinkReference !== 'PENDIENTE-API');
        const carrier = order.shipping?.carrier || 'Correos';

        return `
          <div class="account-order-card" data-order-number="${order.orderNumber}">
            <div class="order-card-header">
              <div>
                <div class="order-card-num">Pedido #${order.orderNumber}</div>
                <div class="order-card-date">${dateStr} &middot; ${carrier}</div>
              </div>
              <div class="order-card-status-badge ${isSimulated ? 'is-test' : 'is-confirmed'}">
                ${isSimulated ? 'Demostración (Prueba)' : 'Confirmado'}
              </div>
            </div>

            <!-- Artículos del pedido -->
            <div class="order-card-items">
              ${(order.items || []).map(item => `
                <div class="order-card-item-row">
                  <img src="${item.image || ''}" alt="${item.title || ''}" class="order-item-thumb" />
                  <div class="order-item-info">
                    <div class="order-item-title">${item.title}</div>
                    <div class="order-item-spec">Talla: <strong>${item.size}</strong> &middot; Cantidad: <strong>${item.quantity}</strong></div>
                  </div>
                  <div class="order-item-price">${formatPrice((item.price || 0) * (item.quantity || 1))}</div>
                </div>
              `).join('')}
            </div>

            <!-- Total y Enlace de Seguimiento -->
            <div class="order-card-footer">
              <div class="order-footer-total">
                <span>Total pagado:</span>
                <strong>${formatPrice(order.total || 0)}</strong>
              </div>

              ${hasTrackingRef ? `
                <button type="button" class="btn-track-order" data-ref="${order.packlinkReference}">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <polyline points="12 6 12 12 16 14"></polyline>
                  </svg>
                  <span>Ver Seguimiento en Vivo</span>
                </button>
              ` : `
                <div class="order-tracking-hint">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="16" x2="12" y2="12"></line>
                    <line x1="12" y1="8" x2="12.01" y2="8"></line>
                  </svg>
                  <span>Paquete en preparación en almacén</span>
                </div>
              `}
            </div>

            <!-- Contenedor dinámico de tracking -->
            <div class="order-tracking-details-box" style="display: none;"></div>
          </div>
        `;
      }).join('')}
    </div>
  `;

  // Attach tracking listeners
  container.querySelectorAll('.btn-track-order').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const card = e.target.closest('.account-order-card');
      const box = card?.querySelector('.order-tracking-details-box');
      const ref = btn.dataset.ref;
      if (!box) return;

      if (box.style.display === 'block') {
        box.style.display = 'none';
        btn.querySelector('span').textContent = 'Ver Seguimiento en Vivo';
        return;
      }

      btn.disabled = true;
      btn.querySelector('span').textContent = 'Consultando...';

      try {
        const info = await getOrderTrackingInfo(ref);
        box.style.display = 'block';
        btn.querySelector('span').textContent = 'Ocultar Seguimiento';

        if (!info.available) {
          box.innerHTML = `<div class="track-msg-info">${info.message}</div>`;
        } else {
          box.innerHTML = `
            <div class="track-timeline">
              <div class="track-header">
                <strong>Transportista:</strong> ${info.carrier || 'Correos'}
                ${info.trackingCode ? ` &middot; Código: <code>${info.trackingCode}</code>` : ''}
              </div>
              <div class="track-status-pill">Estado: ${info.status || 'En tránsito'}</div>
              ${Array.isArray(info.history) && info.history.length > 0 ? `
                <div class="track-events">
                  ${info.history.map(ev => `
                    <div class="track-event-row">
                      <div class="track-event-time">${ev.date || ''}</div>
                      <div class="track-event-desc">${ev.description || ''} (${ev.city || ''})</div>
                    </div>
                  `).join('')}
                </div>
              ` : `
                <div class="track-msg-info" style="margin-top: 6px;">Envío registrado. Próximos movimientos visibles en cuanto el transportista escanee el paquete.</div>
              `}
            </div>
          `;
        }
      } catch (err) {
        box.style.display = 'block';
        box.innerHTML = `<div class="track-msg-error">${err.message || 'Error consultando seguimiento.'}</div>`;
        btn.querySelector('span').textContent = 'Ver Seguimiento en Vivo';
      } finally {
        btn.disabled = false;
      }
    });
  });
}

/**
 * Pestaña Favoritos
 */
function renderFavoritesTab(container, favorites, uid) {
  if (!favorites || favorites.length === 0) {
    container.innerHTML = `
      <div class="account-empty-state">
        <div class="account-empty-icon">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
          </svg>
        </div>
        <h3 class="account-empty-title">No tienes favoritos guardados</h3>
        <p class="account-empty-desc">Guarda las prendas que más te gusten para tenerlas siempre a mano, consultar tallas disponibles y añadirlas a tu carrito.</p>
        <a href="collection.html?cat=todos" class="btn-primary" style="display: inline-block; padding: 10px 20px; font-size: 13px;">
          Explorar Prendas
        </a>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="account-favorites-grid">
      ${favorites.map(item => `
        <div class="account-fav-card" data-fav-id="${item.id}">
          <a href="product.html?id=${item.id}" class="fav-card-media">
            <img src="${item.image || ''}" alt="${item.title || ''}" loading="lazy" />
          </a>
          <div class="fav-card-body">
            <a href="product.html?id=${item.id}" class="fav-card-title">${item.title}</a>
            <div class="fav-card-price">${formatPrice(item.price || 0)}</div>
            <div class="fav-card-actions">
              <a href="product.html?id=${item.id}" class="btn-fav-view">Ver Prenda</a>
              <button type="button" class="btn-fav-remove" data-remove-id="${item.id}" aria-label="Eliminar de favoritos" title="Eliminar de favoritos">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
              </button>
            </div>
          </div>
        </div>
      `).join('')}
    </div>
  `;

  // Listener para eliminar de favoritos
  container.querySelectorAll('.btn-fav-remove').forEach(btn => {
    btn.addEventListener('click', async () => {
      const prodId = btn.dataset.removeId;
      if (!prodId) return;
      btn.disabled = true;
      try {
        await removeCustomerFavorite(uid, prodId);
        cachedFavorites = cachedFavorites.filter(f => f.id !== prodId);
        renderFavoritesTab(container, cachedFavorites, uid);
      } catch (err) {
        btn.disabled = false;
      }
    });
  });
}

/**
 * Pestaña Mis Datos / Perfil
 */
function renderProfileTab(container, profile, uid) {
  const addr = profile.address || {};

  container.innerHTML = `
    <div class="account-profile-form-wrap">
      <div id="account-profile-alert" class="account-alert" style="display: none;"></div>

      <form id="account-profile-form" class="account-form" novalidate>
        <div class="form-group">
          <label class="form-label">Correo electrónico (Cuenta)</label>
          <input type="email" class="form-input" value="${profile.email || ''}" readonly style="background: #f8f7f5; color: #777; cursor: not-allowed;" />
        </div>

        <div class="form-row form-row--2" style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
          <div class="form-group">
            <label for="prof-display-name" class="form-label">Nombre completo</label>
            <input type="text" id="prof-display-name" class="form-input" value="${profile.displayName || ''}" placeholder="Tu nombre" />
          </div>
          <div class="form-group">
            <label for="prof-phone" class="form-label">Teléfono móvil</label>
            <input type="tel" id="prof-phone" class="form-input" value="${profile.phone || ''}" maxlength="9" placeholder="600112233" />
          </div>
        </div>

        <div style="font-size: 13px; font-weight: 700; color: #4d2525; margin: 14px 0 8px; border-top: 1px solid #f0eae6; padding-top: 12px;">
          Dirección de Entrega Predeterminada
        </div>

        <div class="form-group">
          <label for="prof-street" class="form-label">Calle y número</label>
          <input type="text" id="prof-street" class="form-input" value="${addr.street || ''}" placeholder="Calle Mayor 10" />
        </div>

        <div class="form-group">
          <label for="prof-apartment" class="form-label">Piso, puerta, bloque (opcional)</label>
          <input type="text" id="prof-apartment" class="form-input" value="${addr.apartment || ''}" placeholder="2ºB" />
        </div>

        <div class="form-row form-row--3" style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px;">
          <div class="form-group">
            <label for="prof-zip" class="form-label">C.P.</label>
            <input type="text" id="prof-zip" class="form-input" maxlength="5" value="${addr.zipCode || ''}" placeholder="28001" />
          </div>
          <div class="form-group">
            <label for="prof-city" class="form-label">Ciudad</label>
            <input type="text" id="prof-city" class="form-input" value="${addr.city || ''}" placeholder="Madrid" />
          </div>
          <div class="form-group">
            <label for="prof-province" class="form-label">Provincia</label>
            <input type="text" id="prof-province" class="form-input" value="${addr.province || ''}" placeholder="Madrid" />
          </div>
        </div>

        <button type="submit" id="btn-save-profile" class="btn-primary" style="width: 100%; margin-top: 10px;">
          Guardar Cambios
        </button>
      </form>
    </div>
  `;

  const form = container.querySelector('#account-profile-form');
  const alertBox = container.querySelector('#account-profile-alert');
  const submitBtn = container.querySelector('#btn-save-profile');

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!submitBtn) return;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Guardando...';
    if (alertBox) alertBox.style.display = 'none';

    try {
      const displayName = container.querySelector('#prof-display-name')?.value.trim() || '';
      const phone = container.querySelector('#prof-phone')?.value.trim() || '';
      const street = container.querySelector('#prof-street')?.value.trim() || '';
      const apartment = container.querySelector('#prof-apartment')?.value.trim() || '';
      const zipCode = container.querySelector('#prof-zip')?.value.trim() || '';
      const city = container.querySelector('#prof-city')?.value.trim() || '';
      const province = container.querySelector('#prof-province')?.value.trim() || '';

      const updated = {
        displayName,
        phone,
        address: { street, apartment, zipCode, city, province }
      };

      await updateCustomerProfile(uid, updated);
      cachedProfile = { ...cachedProfile, ...updated };

      if (alertBox) {
        alertBox.className = 'account-alert is-success';
        alertBox.textContent = 'Datos actualizados correctamente.';
        alertBox.style.display = 'block';
      }
    } catch (err) {
      if (alertBox) {
        alertBox.className = 'account-alert is-error';
        alertBox.textContent = err.message || 'Error guardando datos.';
        alertBox.style.display = 'block';
      }
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Guardar Cambios';
    }
  });
}

/**
 * Eventos en la vista de no autenticado
 */
function attachAuthEvents(dialog) {
  const alertBox = dialog.querySelector('#account-auth-alert');

  function showAuthAlert(msg, isSuccess = false) {
    if (!alertBox) return;
    alertBox.className = isSuccess ? 'account-alert is-success' : 'account-alert is-error';
    alertBox.textContent = msg;
    alertBox.style.display = 'block';
  }

  // Cambiar pestaña Login / Registro
  dialog.querySelectorAll('.account-switch-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      currentAuthMode = btn.dataset.authMode;
      renderAccountModalContent();
    });
  });

  // Ir a olvidé contraseña
  dialog.querySelector('#btn-forgot-password-link')?.addEventListener('click', () => {
    currentAuthMode = 'forgot';
    renderAccountModalContent();
  });

  // Volver a login desde olvidé contraseña
  dialog.querySelector('#btn-back-to-login')?.addEventListener('click', () => {
    currentAuthMode = 'login';
    renderAccountModalContent();
  });

  // Submit Login
  const loginForm = dialog.querySelector('#account-login-form');
  loginForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = dialog.querySelector('#btn-acc-login');
    const email = dialog.querySelector('#acc-login-email')?.value.trim();
    const pass = dialog.querySelector('#acc-login-pass')?.value;

    if (!email || !pass) {
      showAuthAlert('Por favor, indica tu correo y contraseña.');
      return;
    }

    if (btn) { btn.disabled = true; btn.textContent = 'Iniciando sesión...'; }

    try {
      await loginCustomer(email, pass);
      // onAuthUserChange se encargará de re-renderizar la vista dashboard
    } catch (err) {
      console.error("[Account Login Error]:", err);
      let msg = 'Credenciales no válidas. Por favor, compruébalas.';
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        msg = 'Correo electrónico o contraseña incorrectos.';
      } else if (err.code === 'auth/too-many-requests') {
        msg = 'Demasiados intentos fallidos. Inténtalo más tarde.';
      }
      showAuthAlert(msg);
      if (btn) { btn.disabled = false; btn.textContent = 'Iniciar Sesión'; }
    }
  });

  // Submit Register
  const regForm = dialog.querySelector('#account-register-form');
  regForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = dialog.querySelector('#btn-acc-register');
    const name = dialog.querySelector('#acc-reg-name')?.value.trim();
    const email = dialog.querySelector('#acc-reg-email')?.value.trim();
    const pass = dialog.querySelector('#acc-reg-pass')?.value;

    if (!name || !email || !pass) {
      showAuthAlert('Por favor, completa todos los campos.');
      return;
    }
    if (pass.length < 6) {
      showAuthAlert('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    if (btn) { btn.disabled = true; btn.textContent = 'Creando cuenta...'; }

    try {
      await registerCustomer(email, pass, name);
    } catch (err) {
      console.error("[Account Register Error]:", err);
      let msg = 'No se pudo crear la cuenta. Inténtalo de nuevo.';
      if (err.code === 'auth/email-already-in-use') {
        msg = 'Ya existe una cuenta con este correo electrónico.';
      } else if (err.code === 'auth/invalid-email') {
        msg = 'El formato del correo electrónico no es válido.';
      }
      showAuthAlert(msg);
      if (btn) { btn.disabled = false; btn.textContent = 'Crear mi Cuenta'; }
    }
  });

  // Submit Forgot Password
  const forgotForm = dialog.querySelector('#account-forgot-form');
  forgotForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = dialog.querySelector('#btn-acc-forgot');
    const email = dialog.querySelector('#acc-forgot-email')?.value.trim();

    if (!email) {
      showAuthAlert('Por favor, introduce tu correo electrónico.');
      return;
    }

    if (btn) { btn.disabled = true; btn.textContent = 'Enviando...'; }

    try {
      await requestPasswordReset(email);
      showAuthAlert('Enlace de recuperación enviado. Revisa tu bandeja de entrada.', true);
      setTimeout(() => {
        currentAuthMode = 'login';
        renderAccountModalContent();
      }, 3000);
    } catch (err) {
      showAuthAlert('No pudimos enviar el correo. Verifica que la dirección sea correcta.');
      if (btn) { btn.disabled = false; btn.textContent = 'Enviar Enlace de Recuperación'; }
    }
  });
}

/**
 * Eventos en la vista de usuario autenticado
 */
function attachDashboardEvents(dialog, user) {
  // Cambio de pestañas
  dialog.querySelectorAll('.account-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      activeAccountTab = btn.dataset.tab;
      dialog.querySelectorAll('.account-tab-btn').forEach(b => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      loadActiveTabData(dialog, user);
    });
  });

  // Cerrar Sesión
  dialog.querySelector('#btn-account-logout')?.addEventListener('click', async () => {
    await logoutCustomer();
  });
}
