/**
 * CHECKOUT CONTROLLER - RONEO SHOP (FASE 5.1 DEFINITIVA)
 * Experiencia de pago rápido y seguro estilo Shopify adaptada a España:
 * TPV Virtual Redsys, Bizum, validación Packlink PRO Plus y persistencia ARCHITECTURE.md.
 */

import { getCart, getCartTotals, clearCart } from './cart.js';
import { getProducts, getStoreSettings, updateProductStockAfterOrder, createOrder, generateNextOrderNumber } from './store-service.js';
import { formatPrice, renderAnnouncementMarquee } from './ui.js';

// Clave de pedidos locales para el panel de administración
export const ORDERS_STORAGE_KEY = 'store_orders_v1';

let currentTotals = null;
let currentProductsCatalog = [];

document.addEventListener('DOMContentLoaded', async () => {
  try {
    const [settings, products] = await Promise.all([
      getStoreSettings(),
      getProducts()
    ]);
    currentProductsCatalog = products;
    renderAnnouncementMarquee(settings?.announcementText);

    const threshold = settings?.freeShippingThreshold || 50.00;
    const shippingPrice = settings?.shippingStandardPrice || 4.90;
    currentTotals = getCartTotals(threshold, shippingPrice);

    renderCheckoutSummary(currentTotals);
    setupMobileSummaryToggle();
    setupPaymentMethodAccordion();
    setupFormSubmission();
  } catch (err) {
    console.error("[Checkout] Error durante la inicialización:", err);
  }
});

/**
 * Renderiza el resumen de artículos y totales del pedido
 */
function renderCheckoutSummary(totals) {
  const cart = getCart();
  const listEl = document.getElementById('checkout-items-list');
  const subtotalEl = document.getElementById('checkout-subtotal');
  const shippingEl = document.getElementById('checkout-shipping');
  const totalEl = document.getElementById('checkout-total');
  const toggleTotalEl = document.getElementById('summary-toggle-total');
  const submitBtn = document.getElementById('btn-submit-order');
  const shippingDisplayPrice = document.getElementById('shipping-display-price');

  if (cart.length === 0) {
    if (listEl) {
      listEl.innerHTML = `
        <div style="text-align: center; padding: 2rem 0; color: var(--color-text-muted);">
          <p style="font-size: 14px; margin-bottom: 12px;">Tu cesta está vacía.</p>
          <a href="collection.html?cat=todos" class="btn-primary" style="display: inline-block; max-width: 200px; padding: 10px 16px;">
            Ver Catálogo
          </a>
        </div>
      `;
    }
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'CESTA VACÍA';
    }
    return;
  }

  // Lista de artículos
  if (listEl) {
    listEl.innerHTML = cart.map(item => `
      <div class="checkout-item-row">
        <div class="checkout-item-media">
          <img src="${item.image}" alt="${item.title}" loading="lazy" />
          <span class="checkout-item-qty">${item.quantity}</span>
        </div>
        <div class="checkout-item-details">
          <div class="checkout-item-title">${item.title}</div>
          <div class="checkout-item-size" style="display: flex; align-items: center; gap: 6px; font-size: 12px; color: #555;">
            <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background-color: ${item.colorHex || '#121212'}; border: 1px solid rgba(0,0,0,0.2);"></span>
            <span>Color: <strong>${item.color || 'Único'}</strong></span>
            <span>&middot;</span>
            <span>Talla: <strong>${item.size}</strong></span>
          </div>
        </div>
        <div class="checkout-item-price">${formatPrice(item.price * item.quantity)}</div>
      </div>
    `).join('');
  }

  // Actualizar importes
  if (subtotalEl) subtotalEl.textContent = formatPrice(totals.subtotal);

  if (shippingEl) {
    if (totals.hasFreeShipping) {
      shippingEl.innerHTML = '<strong style="color: #16a34a;">GRATIS</strong>';
    } else {
      shippingEl.textContent = formatPrice(totals.shippingCost);
    }
  }

  if (shippingDisplayPrice) {
    if (totals.hasFreeShipping) {
      shippingDisplayPrice.innerHTML = '<span class="is-free">GRATIS</span>';
    } else {
      shippingDisplayPrice.textContent = formatPrice(totals.shippingCost);
    }
  }

  if (totalEl) totalEl.textContent = formatPrice(totals.total);
  if (toggleTotalEl) toggleTotalEl.textContent = formatPrice(totals.total);

  if (submitBtn) {
    submitBtn.textContent = `PAGAR AHORA · ${formatPrice(totals.total)}`;
  }
}

/**
 * Control del desplegable de resumen en dispositivos móviles
 */
function setupMobileSummaryToggle() {
  const toggleBtn = document.getElementById('summary-toggle');
  const panel = document.getElementById('summary-panel');
  const textEl = document.getElementById('summary-toggle-text');

  if (toggleBtn && panel) {
    toggleBtn.addEventListener('click', () => {
      const isOpen = panel.classList.toggle('is-open');
      toggleBtn.setAttribute('aria-expanded', String(isOpen));
      if (textEl) {
        textEl.textContent = isOpen
          ? 'Ocultar resumen del pedido ▴'
          : 'Mostrar resumen del pedido ▾';
      }
    });
  }
}

/**
 * Control del selector acordeón de métodos de pago (Redsys Tarjeta vs Bizum)
 */
function setupPaymentMethodAccordion() {
  const cardItem = document.getElementById('payment-card-opt');
  const bizumItem = document.getElementById('payment-bizum-opt');

  const cardRadio = cardItem?.querySelector('input[type="radio"]');
  const bizumRadio = bizumItem?.querySelector('input[type="radio"]');

  const selectCard = () => {
    if (cardRadio) cardRadio.checked = true;
    cardItem?.classList.add('is-selected');
    bizumItem?.classList.remove('is-selected');
  };

  const selectBizum = () => {
    if (bizumRadio) bizumRadio.checked = true;
    bizumItem?.classList.add('is-selected');
    cardItem?.classList.remove('is-selected');
  };

  cardItem?.addEventListener('click', selectCard);
  bizumItem?.addEventListener('click', selectBizum);
}

/**
 * Genera el número de pedido oficial de 12 dígitos exigido por Redsys (DS_MERCHANT_ORDER)
 * Formato: YYMMDDHHMMSS (ejemplo: 261104203512)
 */
export function generateRedsysOrderNumber() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');

  const yy = String(now.getFullYear()).slice(-2);
  const mm = pad(now.getMonth() + 1);
  const dd = pad(now.getDate());
  const hh = pad(now.getHours());
  const min = pad(now.getMinutes());
  const ss = pad(now.getSeconds());

  return `${yy}${mm}${dd}${hh}${min}${ss}`;
}

/**
 * Función preparada para delegar la firma bancaria y cobro al Cloudflare Worker (Fase 4)
 * @param {Object} order Objeto de pedido construido según ARCHITECTURE.md
 */
export async function initiateRedsysPayment(order) {
  console.info("[Redsys] Conectando con Cloudflare Worker / Redsys TPV Virtual:", {
    orderNumber: order.orderNumber,
    amount: order.total,
    currency: "978", // EUR
    paymentMethod: order.paymentMethod
  });
  // Simulación del handshake seguro de 1.2 segundos
  return new Promise((resolve) => setTimeout(resolve, 1200));
}

/**
 * Guarda el pedido en localStorage (store_orders_v1) para el panel /admin
 */
function saveOrderLocally(order) {
  try {
    const raw = localStorage.getItem(ORDERS_STORAGE_KEY);
    const orders = raw ? JSON.parse(raw) : [];
    orders.unshift(order);
    localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(orders));
  } catch (e) {
    console.warn("[Checkout] Error guardando pedido en historial local:", e);
  }
}

/**
 * Gestión del envío del formulario y validaciones estrictas para Packlink PRO y Redsys
 */
function setupFormSubmission() {
  const form = document.getElementById('checkout-form');
  const errorBox = document.getElementById('checkout-error-msg');
  const submitBtn = document.getElementById('btn-submit-order');

  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (errorBox) errorBox.style.display = 'none';

    const cart = getCart();
    if (cart.length === 0) {
      showError('Tu cesta está vacía. Añade artículos antes de finalizar la compra.');
      return;
    }

    // Extracción de datos del formulario
    const email = document.getElementById('checkout-email')?.value.trim();
    const phone = document.getElementById('checkout-phone')?.value.trim();
    const firstName = document.getElementById('checkout-firstname')?.value.trim();
    const lastName = document.getElementById('checkout-lastname')?.value.trim();
    const street = document.getElementById('checkout-street')?.value.trim();
    const zipCode = document.getElementById('checkout-zip')?.value.trim();
    const city = document.getElementById('checkout-city')?.value.trim();
    const province = document.getElementById('checkout-province')?.value.trim();

    const paymentRadio = document.querySelector('input[name="paymentMethod"]:checked');
    const paymentMethod = paymentRadio ? paymentRadio.value : 'CARD';

    // 1. Validaciones
    if (!email || !email.includes('@') || !email.includes('.')) {
      showError('Por favor, introduce un correo electrónico válido.');
      return;
    }

    // Teléfono móvil español (9 dígitos empezando por 6, 7, 8 o 9)
    const phoneRegex = /^[6789]\d{8}$/;
    if (!phone || !phoneRegex.test(phone)) {
      showError('Por favor, introduce un teléfono móvil español válido de 9 dígitos (ej. 600112233) para avisos SMS y Bizum.');
      return;
    }

    if (!firstName || !lastName) {
      showError('Por favor, indica tu nombre y apellidos completos.');
      return;
    }

    if (!street || street.length < 5) {
      showError('Por favor, indica una dirección de entrega completa (calle, número, piso).');
      return;
    }

    // Código postal español (5 dígitos)
    const zipRegex = /^\d{5}$/;
    if (!zipCode || !zipRegex.test(zipCode)) {
      showError('Por favor, indica un código postal español válido de 5 dígitos.');
      return;
    }

    if (!city || !province) {
      showError('Por favor, selecciona tu provincia e indica la localidad.');
      return;
    }

    // 2. Cálculo del peso total para la API de Packlink PRO
    let totalWeightKg = 0;
    for (const item of cart) {
      const prodData = currentProductsCatalog.find(p => p.id === item.productId);
      const unitWeight = prodData?.weightKg || 0.35;
      totalWeightKg += unitWeight * item.quantity;
    }
    totalWeightKg = Math.round(totalWeightKg * 100) / 100;

    // 3. Generación del número de pedido oficial español diario (DD-MM-YYYY-NNN)
    const orderNumber = await generateNextOrderNumber();

    // 4. Construcción del objeto de pedido según ARCHITECTURE.md Sección 2.B
    const newOrder = {
      orderNumber,
      redsysOrderId: orderNumber.replace(/-/g, ''),
      status: "PAID",
      paymentMethod, // 'CARD' o 'BIZUM'
      subtotal: currentTotals.subtotal,
      shippingCost: currentTotals.shippingCost,
      total: currentTotals.total,
      totalWeightKg,
      customer: {
        firstName,
        lastName,
        email,
        phone,
        street,
        city,
        province,
        zipCode,
        country: "ES"
      },
      items: cart.map(item => ({
        productId: item.productId,
        title: item.title,
        size: item.size,
        color: item.color || 'Único',
        colorHex: item.colorHex || '#121212',
        price: item.price,
        quantity: item.quantity,
        image: item.image
      })),
      packlink: {
        synced: false,
        reference: "PENDIENTE-API",
        trackingUrl: ""
      },
      createdAt: Date.now(),
      paidAt: Date.now()
    };

    // 5. Estado de carga y simulación de pasarela segura Redsys/Bizum
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = paymentMethod === 'BIZUM'
        ? 'Conectando con Bizum / Redsys...'
        : 'Conectando con TPV Virtual Redsys...';
    }

    try {
      await initiateRedsysPayment(newOrder);

      // Guardar pedido en Firestore y almacenamiento sincronizado
      await createOrder(newOrder);

      // Descontar stock de prendas en tiempo real (Fase 3)
      await updateProductStockAfterOrder(newOrder.items);

      // Vaciar carrito
      clearCart();

      // Renderizar pantalla de confirmación
      renderOrderConfirmation(newOrder);
    } catch (err) {
      console.error("[Checkout] Error procesando el pago:", err);
      showError('Ocurrió un error al procesar el pago con la pasarela bancaria. Por favor, inténtalo de nuevo.');
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = `PAGAR AHORA · ${formatPrice(currentTotals.total)}`;
      }
    }
  });

  function showError(msg) {
    if (errorBox) {
      errorBox.textContent = msg;
      errorBox.style.display = 'block';
      errorBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }
}

/**
 * Renderiza la pantalla final de Pedido Confirmado
 */
function renderOrderConfirmation(order) {
  const container = document.getElementById('checkout-main-content');
  const summaryPanel = document.getElementById('summary-panel');
  const toggleBtn = document.getElementById('summary-toggle');

  if (summaryPanel) summaryPanel.style.display = 'none';
  if (toggleBtn) toggleBtn.style.display = 'none';

  if (!container) return;

  window.scrollTo({ top: 0, behavior: 'smooth' });

  const methodLabel = order.paymentMethod === 'BIZUM'
    ? 'Bizum (Autorizado)'
    : 'Tarjeta Bancaria (Autorizada)';

  container.innerHTML = `
    <div class="order-confirmation-box">
      <div class="order-success-icon">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
      </div>
      <h2 class="order-success-title">¡Gracias por tu pedido, ${order.customer.firstName}!</h2>
      <p style="font-size: 13.5px; color: var(--color-text-muted); margin-bottom: 14px;">
        Hemos recibido tu pago correctamente y estamos preparando tu paquete.
      </p>

      <div class="order-number-badge">
        Nº DE PEDIDO: #${order.orderNumber}
      </div>

      <div class="order-summary-card">
        <h3 style="font-size: 14px; font-weight: 700; margin-bottom: 12px; text-transform: uppercase;">
          Detalles de la Entrega (Packlink PRO)
        </h3>
        <p style="font-size: 13px; line-height: 1.6; color: #333;">
          <strong>Destinatario:</strong> ${order.customer.firstName} ${order.customer.lastName}<br>
          <strong>Dirección:</strong> ${order.customer.street}, ${order.customer.zipCode} ${order.customer.city} (${order.customer.province})<br>
          <strong>Teléfono de aviso:</strong> ${order.customer.phone}<br>
          <strong>Email:</strong> ${order.customer.email}<br>
          <strong>Método de pago:</strong> ${methodLabel}<br>
          <strong>Plazo estimado:</strong> 24/48 horas laborables
        </p>

        <div style="border-top: 1px solid #e5e5e5; margin: 14px 0; padding-top: 12px;">
          <h4 style="font-size: 13px; font-weight: 700; margin-bottom: 8px;">Artículos comprados:</h4>
          ${order.items.map(item => `
            <div style="display: flex; justify-content: space-between; font-size: 12.5px; margin-bottom: 6px;">
              <span>${item.quantity}x ${item.title} (${item.color ? item.color + ' · ' : ''}Talla ${item.size})</span>
              <strong>${formatPrice(item.price * item.quantity)}</strong>
            </div>
          `).join('')}
          <div style="display: flex; justify-content: space-between; font-size: 14px; font-weight: 700; margin-top: 10px; border-top: 1px solid #ddd; padding-top: 8px;">
            <span>Total Pagado:</span>
            <span>${formatPrice(order.total)}</span>
          </div>
        </div>
      </div>

      <a href="index.html" class="btn-primary" style="display: inline-flex; max-width: 260px; margin: 0 auto;">
        Volver a la tienda
      </a>
    </div>
  `;
}

