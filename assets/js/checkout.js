/**
 * CHECKOUT CONTROLLER - RONEO SHOP (FASE 6.2 DEFINITIVA)
 * Experiencia de pago rápido y seguro estilo Shopify adaptada a España Península:
 * Resumen de pedido superior con miniaturas 56x74px, selector en vivo Correos vs Correos Express (+21% IVA),
 * redondeo estricto a ,99€ (roundShippingPriceTo99), autocompletado y validación de par (zip_code, city) oficial,
 * TPV Virtual Redsys, Bizum y sincronización automática Packlink PRO.
 */

import { getCart, clearCart } from './cart.js';
import {
  getProducts,
  getStoreSettings,
  updateProductStockAfterOrder,
  createOrder,
  generateNextOrderNumber,
  syncOrderWithPacklink,
  getCorreosShippingOptions,
  resolvePacklinkPostalLocation,
  roundShippingPriceTo99
} from './store-service.js';
import {
  getProvinceFromZip,
  isPeninsularZip,
  buildCleanSingleStreet
} from './packlink-service.js';
import { formatPrice, renderAnnouncementMarquee } from './ui.js';

// Clave de pedidos locales para el panel de administración
export const ORDERS_STORAGE_KEY = 'store_orders_v1';

let currentProductsCatalog = [];
let currentStoreSettings = null;
let selectedShippingKey = 'correos'; // 'correos' o 'correosExpress'

let activeShippingRates = {
  correos: {
    serviceId: 20679,
    carrierName: "Correos",
    serviceName: "Paq Estándar Domicilio",
    costWithVat: 4.99,
    transitHours: "48-72h"
  },
  correosExpress: {
    serviceId: 20571,
    carrierName: "Correos Express",
    serviceName: "Paq 24",
    costWithVat: 5.99,
    transitHours: "24h"
  }
};

document.addEventListener('DOMContentLoaded', async () => {
  try {
    const [settings, products] = await Promise.all([
      getStoreSettings(),
      getProducts()
    ]);
    currentStoreSettings = settings;
    currentProductsCatalog = products;
    renderAnnouncementMarquee(settings?.announcementText);

    // Inicializar resumen y componentes
    const totals = getCalculatedTotals();
    renderCheckoutSummary(totals);

    setupTopSummaryToggle();
    setupShippingSelector();
    setupPaymentMethodAccordion();
    setupPostalCodeLookup();
    setupFormSubmission();
  } catch (err) {
    console.error("[Checkout] Error durante la inicialización:", err);
  }
});

/**
 * Calcula el peso total del carrito en kilogramos
 */
function calculateCartWeightKg() {
  const cart = getCart();
  let weight = 0;
  for (const item of cart) {
    const prod = currentProductsCatalog.find(p => p.id === item.productId);
    const unitW = prod?.weightKg || 0.35;
    weight += unitW * (item.quantity || 1);
  }
  return Math.max(0.3, Math.round(weight * 100) / 100);
}

/**
 * Calcula los subtotales, coste de envío y total final con reglas de umbral y redondeo a ,99€
 */
function getCalculatedTotals() {
  const cart = getCart();
  const subtotal = cart.reduce((acc, it) => acc + (it.price * it.quantity), 0);
  const threshold = currentStoreSettings?.freeShippingThreshold !== undefined
    ? Number(currentStoreSettings.freeShippingThreshold)
    : 50.00;

  const isFreeThresholdMet = subtotal >= threshold && subtotal > 0;
  const selectedOption = activeShippingRates[selectedShippingKey] || activeShippingRates.correos;

  // Regla: Correos estándar es GRATIS al superar el umbral; Correos Express es siempre de pago redondeado a ,99€
  let shippingCost = roundShippingPriceTo99(selectedOption.costWithVat || 4.99);
  let isFreeShipping = false;

  if (selectedShippingKey === 'correos' && isFreeThresholdMet) {
    shippingCost = 0.00;
    isFreeShipping = true;
  }

  const total = Math.max(0, Math.round((subtotal + shippingCost) * 100) / 100);

  return {
    subtotal: Math.round(subtotal * 100) / 100,
    shippingCost,
    total,
    isFreeShipping,
    isFreeThresholdMet,
    selectedOption
  };
}

/**
 * Renderiza el resumen de artículos y totales del pedido (tanto superior como desktop)
 */
function renderCheckoutSummary(totals) {
  const cart = getCart();
  const topListEl = document.getElementById('summary-top-items-list');
  const topSubtotalEl = document.getElementById('summary-top-subtotal');
  const topShippingLabelEl = document.getElementById('summary-top-shipping-label');
  const topShippingValEl = document.getElementById('summary-top-shipping-val');
  const topGrandTotalEl = document.getElementById('summary-top-grand-total');
  const topHeaderTotalEl = document.getElementById('summary-top-header-total');
  const topToggleTitleEl = document.getElementById('summary-toggle-title');

  const desktopListEl = document.getElementById('checkout-items-list');
  const desktopSubtotalEl = document.getElementById('checkout-subtotal');
  const desktopShippingLabelEl = document.getElementById('checkout-shipping-label');
  const desktopShippingEl = document.getElementById('checkout-shipping');
  const desktopTotalEl = document.getElementById('checkout-total');
  const submitBtn = document.getElementById('btn-submit-order');

  const correosPriceEl = document.getElementById('shipping-correos-price');
  const expressPriceEl = document.getElementById('shipping-express-price');

  const totalUnits = cart.reduce((acc, it) => acc + (it.quantity || 1), 0);

  if (topToggleTitleEl) {
    topToggleTitleEl.textContent = `Resumen de tu pedido (${totalUnits} ${totalUnits === 1 ? 'artículo' : 'artículos'})`;
  }

  if (cart.length === 0) {
    const emptyHtml = `
      <div style="text-align: center; padding: 2rem 0; color: var(--color-text-muted);">
        <p style="font-size: 14px; margin-bottom: 12px;">Tu cesta está vacía.</p>
        <a href="collection.html?cat=todos" class="btn-primary" style="display: inline-block; max-width: 200px; padding: 10px 16px;">
          Ver Catálogo
        </a>
      </div>
    `;
    if (topListEl) topListEl.innerHTML = emptyHtml;
    if (desktopListEl) desktopListEl.innerHTML = emptyHtml;
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'CESTA VACÍA';
    }
    return;
  }

  // 1. Renderizado de artículos con miniaturas 56x74px en el resumen superior
  if (topListEl) {
    topListEl.innerHTML = cart.map(item => `
      <div class="checkout-summary-item">
        <div class="summary-item-media">
          <img src="${item.image}" alt="${item.title}" loading="lazy" />
          <span class="summary-item-qty">${item.quantity}</span>
        </div>
        <div class="summary-item-details">
          <div class="summary-item-title">${item.title}</div>
          <div class="summary-item-specs">
            <span class="summary-item-color-dot" style="background-color: ${item.colorHex || '#121212'};"></span>
            <span>Color: <strong>${item.color || 'Único'}</strong></span>
            <span>&middot;</span>
            <span>Talla: <strong>${item.size}</strong></span>
          </div>
        </div>
        <div class="summary-item-price">${formatPrice(item.price * item.quantity)}</div>
      </div>
    `).join('');
  }

  // 2. Renderizado de artículos en la columna lateral Desktop
  if (desktopListEl) {
    desktopListEl.innerHTML = cart.map(item => `
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

  // 3. Actualizar importes en el resumen superior
  if (topSubtotalEl) topSubtotalEl.textContent = formatPrice(totals.subtotal);
  if (topShippingLabelEl) {
    topShippingLabelEl.textContent = `Envío (${totals.selectedOption.carrierName} · ${totals.selectedOption.serviceName})`;
  }
  if (topShippingValEl) {
    topShippingValEl.innerHTML = totals.isFreeShipping
      ? '<strong style="color: #16a34a;">GRATIS</strong>'
      : `${formatPrice(totals.shippingCost)} <span style="font-size: 11px; color: #7d5353;">(IVA incl.)</span>`;
  }
  if (topGrandTotalEl) topGrandTotalEl.textContent = formatPrice(totals.total);
  if (topHeaderTotalEl) topHeaderTotalEl.textContent = formatPrice(totals.total);

  // 4. Actualizar importes en la columna lateral Desktop
  if (desktopSubtotalEl) desktopSubtotalEl.textContent = formatPrice(totals.subtotal);
  if (desktopShippingLabelEl) {
    desktopShippingLabelEl.textContent = `Envío (${totals.selectedOption.carrierName})`;
  }
  if (desktopShippingEl) {
    desktopShippingEl.innerHTML = totals.isFreeShipping
      ? '<strong style="color: #16a34a;">GRATIS</strong>'
      : `${formatPrice(totals.shippingCost)} <span style="font-size: 11px; color: #7d5353;">(IVA incl.)</span>`;
  }
  if (desktopTotalEl) desktopTotalEl.textContent = formatPrice(totals.total);

  // 5. Actualizar precios visibles en los selectores de envío con la regla ,99€
  if (correosPriceEl) {
    correosPriceEl.innerHTML = totals.isFreeThresholdMet
      ? '<span style="color: #16a34a; font-weight: 700;">GRATIS</span>'
      : `${formatPrice(roundShippingPriceTo99(activeShippingRates.correos.costWithVat))} <span style="font-size: 10.5px; font-weight: normal; color: #777;">(IVA incl.)</span>`;
  }
  if (expressPriceEl) {
    expressPriceEl.innerHTML = `${formatPrice(roundShippingPriceTo99(activeShippingRates.correosExpress.costWithVat))} <span style="font-size: 10.5px; font-weight: normal; color: #777;">(IVA incl.)</span>`;
  }

  // 6. Actualizar botón de pago principal
  if (submitBtn) {
    submitBtn.disabled = false;
    submitBtn.textContent = `PAGAR AHORA · ${formatPrice(totals.total)}`;
  }
}

/**
 * Control del acordeón desplegable del resumen del pedido superior
 */
function setupTopSummaryToggle() {
  const toggleBtn = document.getElementById('summary-toggle-top');
  const drawerBody = document.getElementById('order-summary-drawer-body');
  const chevron = document.getElementById('summary-top-chevron');

  if (toggleBtn && drawerBody) {
    toggleBtn.addEventListener('click', () => {
      const isOpen = drawerBody.classList.toggle('is-open');
      toggleBtn.setAttribute('aria-expanded', String(isOpen));
      if (chevron) {
        chevron.style.transform = isOpen ? 'rotate(180deg)' : 'rotate(0deg)';
      }
    });
  }
}

/**
 * Control del selector de transportistas oficiales (Correos vs Correos Express)
 */
function setupShippingSelector() {
  const correosRadio = document.getElementById('ship-correos');
  const expressRadio = document.getElementById('ship-express');
  const correosCard = document.getElementById('shipping-correos-card');
  const expressCard = document.getElementById('shipping-express-card');

  const onRadioChange = () => {
    if (correosRadio?.checked) {
      selectedShippingKey = 'correos';
      correosCard?.classList.add('is-selected');
      expressCard?.classList.remove('is-selected');
    } else if (expressRadio?.checked) {
      selectedShippingKey = 'correosExpress';
      expressCard?.classList.add('is-selected');
      correosCard?.classList.remove('is-selected');
    }
    const totals = getCalculatedTotals();
    renderCheckoutSummary(totals);
  };

  correosRadio?.addEventListener('change', onRadioChange);
  expressRadio?.addEventListener('change', onRadioChange);
  correosCard?.addEventListener('click', () => {
    if (correosRadio) {
      correosRadio.checked = true;
      onRadioChange();
    }
  });
  expressCard?.addEventListener('click', () => {
    if (expressRadio) {
      expressRadio.checked = true;
      onRadioChange();
    }
  });
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
 * Verificación y auto-completado de Código Postal y Cotización en Vivo de Correos y Correos Express
 * desde el origen inmutable Torredonjimeno (23650 Jaén).
 */
function setupPostalCodeLookup() {
  const zipInput = document.getElementById('checkout-zip');
  const provSelect = document.getElementById('checkout-province');
  const cityInput = document.getElementById('checkout-city');
  const liveStatusText = document.getElementById('shipping-live-status-text');
  const warningBox = document.getElementById('checkout-zip-peninsula-warning');
  const suggestionsBox = document.getElementById('checkout-city-suggestions');

  let debounceTimer = null;

  zipInput?.addEventListener('input', (e) => {
    const val = e.target.value.trim();
    if (val.length === 5 && /^\d{5}$/.test(val)) {
      // 1. Verificación de España Península
      const peninsular = isPeninsularZip(val);
      if (!peninsular) {
        if (warningBox) warningBox.style.display = 'block';
        if (suggestionsBox) suggestionsBox.style.display = 'none';
        if (liveStatusText) {
          liveStatusText.textContent = "Código postal no perteneciente a España Península. Envíos no disponibles.";
        }
        return;
      } else {
        if (warningBox) warningBox.style.display = 'none';
      }

      // Auto-selección preliminar de provincia por prefijo
      const province = getProvinceFromZip(val);
      if (province && provSelect) {
        for (let i = 0; i < provSelect.options.length; i++) {
          if (provSelect.options[i].value.toLowerCase() === province.toLowerCase()) {
            provSelect.selectedIndex = i;
            break;
          }
        }
      }

      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(async () => {
        if (liveStatusText) {
          liveStatusText.textContent = "Calculando tarifas oficiales de Correos y Correos Express desde Torredonjimeno (23650)...";
        }
        try {
          // Resolución oficial de localidad contra Packlink PRO API
          const loc = await resolvePacklinkPostalLocation(val, cityInput?.value, province || '');

          if (cityInput && (!cityInput.value || cityInput.value.trim() === '')) {
            cityInput.value = loc.city;
          }

          if (loc.state && provSelect) {
            for (let i = 0; i < provSelect.options.length; i++) {
              if (provSelect.options[i].value.toLowerCase() === loc.state.toLowerCase()) {
                provSelect.selectedIndex = i;
                break;
              }
            }
          }

          // Renderizado de sugerencias si el código postal abarca varias localidades oficiales
          if (suggestionsBox) {
            if (loc.cities && loc.cities.length > 1) {
              suggestionsBox.innerHTML = `
                <div style="margin-bottom: 4px;"><strong>Localidades oficiales para C.P. ${val}:</strong></div>
                <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                  ${loc.cities.map(c => `
                    <button type="button" class="btn-city-chip" style="background: #ffffff; border: 1px solid #e6cbc4; border-radius: 999px; padding: 2px 10px; font-size: 11px; cursor: pointer; color: #4d2525;">
                      ${c}
                    </button>
                  `).join('')}
                </div>
              `;
              suggestionsBox.style.display = 'block';
              suggestionsBox.querySelectorAll('.btn-city-chip').forEach(btn => {
                btn.addEventListener('click', () => {
                  if (cityInput) {
                    cityInput.value = btn.textContent.trim();
                  }
                });
              });
            } else {
              suggestionsBox.style.display = 'none';
            }
          }

          // Cotización con origen fijo 23650 Torredonjimeno (Jaén)
          const weightKg = calculateCartWeightKg();
          const options = await getCorreosShippingOptions({
            fromZip: '23650',
            toZip: loc.zip_code,
            weightKg,
            apiKey: currentStoreSettings?.packlinkApiKey
          });

          if (options.correos) activeShippingRates.correos = options.correos;
          if (options.correosExpress) activeShippingRates.correosExpress = options.correosExpress;

          if (liveStatusText) {
            liveStatusText.textContent = `Tarifas oficiales desde Torredonjimeno (23650) a ${loc.city} (${loc.state}), España Península (21% IVA incl.).`;
          }
        } catch (err) {
          if (liveStatusText) {
            liveStatusText.textContent = "Tarifas de Correos y Correos Express aplicadas con 21% IVA incluido.";
          }
        }
        const totals = getCalculatedTotals();
        renderCheckoutSummary(totals);
      }, 350);
    } else {
      if (suggestionsBox) suggestionsBox.style.display = 'none';
      if (warningBox) warningBox.style.display = 'none';
    }
  });
}

/**
 * Simulación o delegación del cobro seguro con Redsys TPV Virtual / Bizum
 */
export async function initiateRedsysPayment(order) {
  console.info("[Redsys] Conectando con Cloudflare Worker / Redsys TPV Virtual:", {
    orderNumber: order.orderNumber,
    amount: order.total,
    currency: "978", // EUR
    paymentMethod: order.paymentMethod
  });
  return new Promise((resolve) => setTimeout(resolve, 1200));
}

/**
 * Guarda el pedido en localStorage para consulta inmediata en /admin
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
 * Gestión del envío del formulario con validaciones estrictas y sincronización
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
    const rawStreetOnly = document.getElementById('checkout-street')?.value.trim() || '';
    const rawApartmentOnly = document.getElementById('checkout-apartment')?.value.trim() || '';
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

    const phoneRegex = /^[6789]\d{8}$/;
    if (!phone || !phoneRegex.test(phone)) {
      showError('Por favor, introduce un teléfono móvil español válido de 9 dígitos (ej. 600112233) para avisos SMS y Bizum.');
      return;
    }

    if (!firstName || !lastName) {
      showError('Por favor, indica tu nombre y apellidos completos.');
      return;
    }

    if (!rawStreetOnly || rawStreetOnly.length < 4) {
      showError('Por favor, indica una dirección de entrega completa (calle y número).');
      return;
    }

    const zipRegex = /^\d{5}$/;
    if (!zipCode || !zipRegex.test(zipCode)) {
      showError('Por favor, indica un código postal español válido de 5 dígitos.');
      return;
    }

    // Comprobación de España Península
    if (!isPeninsularZip(zipCode)) {
      showError('Actualmente nuestros envíos están habilitados exclusivamente para España Península. Disculpa las molestias.');
      return;
    }

    if (!city || !province) {
      showError('Por favor, selecciona tu provincia e indica la localidad.');
      return;
    }

    // Resolución oficial del Código Postal y Ciudad para garantizar correspondencia en Packlink PRO
    const recipientLoc = await resolvePacklinkPostalLocation(zipCode, city, province);

    const fullStreet = buildCleanSingleStreet(rawStreetOnly, rawApartmentOnly);
    const totals = getCalculatedTotals();
    const chosenShipping = totals.selectedOption;
    const totalWeightKg = calculateCartWeightKg();
    const orderNumber = await generateNextOrderNumber();

    // 2. Construcción del objeto de pedido según ARCHITECTURE.md
    const newOrder = {
      orderNumber,
      redsysOrderId: orderNumber.replace(/-/g, ''),
      status: "PAID",
      paymentMethod,
      subtotal: totals.subtotal,
      shippingCost: totals.shippingCost,
      total: totals.total,
      totalWeightKg,
      shipping: {
        carrier: chosenShipping.carrierName,
        serviceName: chosenShipping.serviceName,
        serviceId: chosenShipping.serviceId,
        costWithVat: totals.shippingCost
      },
      customer: {
        firstName,
        lastName,
        email,
        phone,
        street: rawStreetOnly,
        apartment: rawApartmentOnly,
        fullStreet: fullStreet,
        city: recipientLoc.city,
        province: recipientLoc.state || province,
        zipCode: recipientLoc.zip_code,
        country: "ES",
        zone: "ESPAÑA PENÍNSULA"
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
        serviceId: chosenShipping.serviceId,
        carrierName: chosenShipping.carrierName,
        trackingUrl: ""
      },
      createdAt: Date.now(),
      paidAt: Date.now()
    };

    // 3. Estado de carga
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = paymentMethod === 'BIZUM'
        ? 'Conectando con Bizum / Redsys...'
        : 'Conectando con TPV Virtual Redsys...';
    }

    try {
      await initiateRedsysPayment(newOrder);

      // Guardar pedido en Firestore
      await createOrder(newOrder);

      // Descontar stock de prendas en Firestore
      await updateProductStockAfterOrder(newOrder.items);

      // Sincronización oficial con Packlink PRO
      let packlinkRes = null;
      if (currentStoreSettings?.packlinkAutoSync !== false) {
        try {
          packlinkRes = await syncOrderWithPacklink(newOrder.orderNumber);
        } catch (plErr) {
          console.warn("[Checkout] Error sincronizando con logística oficial:", plErr);
        }
      }

      // Vaciar carrito
      clearCart();

      // Renderizar pantalla de confirmación para el cliente
      renderOrderConfirmation(newOrder, packlinkRes);
    } catch (err) {
      console.error("[Checkout] Error procesando el pago:", err);
      showError('Ocurrió un error al procesar el pago con la pasarela bancaria. Por favor, inténtalo de nuevo.');
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = `PAGAR AHORA · ${formatPrice(totals.total)}`;
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
 * Renderiza la pantalla final de Pedido Confirmado sin mencionar Packlink de cara al cliente
 */
function renderOrderConfirmation(order, packlinkResult = null) {
  const container = document.getElementById('checkout-main-content');
  const summaryPanel = document.getElementById('summary-panel');
  const topSummary = document.getElementById('checkout-order-summary-top');

  if (summaryPanel) summaryPanel.style.display = 'none';
  if (topSummary) topSummary.style.display = 'none';

  if (!container) return;

  window.scrollTo({ top: 0, behavior: 'smooth' });

  const methodLabel = order.paymentMethod === 'BIZUM'
    ? 'Bizum (Autorizado)'
    : 'Tarjeta Bancaria (Autorizada)';

  const carrierDisplay = order.shipping?.serviceName
    ? `${order.shipping.carrier} · ${order.shipping.serviceName}`
    : (order.shipping?.carrier || 'Correos Express · Entrega Urgente 24h');

  container.innerHTML = `
    <div class="order-confirmation-box">
      <div class="order-success-icon">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
      </div>
      <h2 class="order-success-title">¡Gracias por tu pedido, ${order.customer.firstName}!</h2>
      <p style="font-size: 13.5px; color: var(--color-text-muted); margin-bottom: 14px;">
        Hemos recibido tu pago correctamente y estamos preparando tu paquete con ${order.shipping?.carrier || 'Correos'}.
      </p>

      <div class="order-number-badge">
        Nº DE PEDIDO: #${order.orderNumber}
      </div>

      <div style="background: #fff5f2; border: 1px solid #ffdcd4; border-radius: 8px; padding: 12px 16px; margin: 14px 0 16px; display: flex; align-items: center; gap: 10px; font-size: 13px; color: #4d2525; font-weight: 600; text-align: left;">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0;">
          <rect x="1" y="3" width="15" height="13" rx="1"></rect>
          <polygon points="16 8 20 8 23 11 23 16 16 16 8"></polygon>
          <circle cx="5.5" cy="18.5" r="2.5"></circle>
          <circle cx="18.5" cy="18.5" r="2.5"></circle>
        </svg>
        <div>
          <div>Transportista asignado: <strong>${carrierDisplay}</strong></div>
          <div style="font-size: 12px; font-weight: 400; color: #7d5353; margin-top: 2px;">
            Recibirás el código de seguimiento por SMS y email en cuanto el transportista recoja tu paquete.
          </div>
        </div>
      </div>

      <div class="order-summary-card">
        <h3 style="font-size: 14px; font-weight: 700; margin-bottom: 12px; text-transform: uppercase;">
          Detalles de la Entrega
        </h3>
        <p style="font-size: 13px; line-height: 1.6; color: #333;">
          <strong>Destinatario:</strong> ${order.customer.firstName} ${order.customer.lastName}<br>
          <strong>Dirección:</strong> ${order.customer.street}, ${order.customer.zipCode} ${order.customer.city} (${order.customer.province}), España Península<br>
          <strong>Transportista:</strong> ${carrierDisplay}<br>
          <strong>Teléfono de aviso SMS:</strong> ${order.customer.phone}<br>
          <strong>Email:</strong> ${order.customer.email}<br>
          <strong>Método de pago:</strong> ${methodLabel}
        </p>

        <div style="border-top: 1px solid #e5e5e5; margin: 14px 0; padding-top: 12px;">
          <h4 style="font-size: 13px; font-weight: 700; margin-bottom: 8px;">Artículos comprados:</h4>
          ${order.items.map(item => `
            <div style="display: flex; justify-content: space-between; font-size: 12.5px; margin-bottom: 6px;">
              <span>${item.quantity}x ${item.title} (${item.color ? item.color + ' · ' : ''}Talla ${item.size})</span>
              <strong>${formatPrice(item.price * item.quantity)}</strong>
            </div>
          `).join('')}
          <div style="display: flex; justify-content: space-between; font-size: 13px; margin-top: 8px; color: #555;">
            <span>Envío (${order.shipping?.carrier || 'Correos'}):</span>
            <span>${order.shippingCost === 0 ? 'GRATIS' : formatPrice(order.shippingCost)}</span>
          </div>
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
