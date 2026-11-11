/**
 * PACKLINK PRO SERVICE - RONEO SHOP (FASE 6.1 OFICIAL SEGURO)
 * Intermediación 100% segura mediante Cloud Functions Proxy (/api/packlink).
 * Cero secretos en cliente. La API Key reside exclusivamente en Firebase Secret Manager.
 * Operaciones sensibles (POST / envíos) protegidas mediante Firebase ID Token de Administrador.
 * Exclusividad de líneas de transporte para cliente: Correos y Correos Express (con 21% IVA).
 * Zero Emojis · 100% Iconos Vectoriales SVG.
 */

import { auth } from './firebase-config.js';

export const DEFAULT_PACKLINK_API_KEY = "";
export const PACKLINK_API_BASE = "/api/packlink";

/**
 * DATOS FIJOS E INMUTABLES DEL REMITENTE ("NOSOTROS") - RONEO SHOP
 * Nerea Cortes Muñoz - Calle Norte 70, 23650 Torredonjimeno (Jaén), España Península.
 */
export const FIXED_SENDER_ADDRESS = {
  name: "Nerea",
  surname: "Cortes Muñoz",
  fullName: "Nerea Cortes Muñoz",
  company: "Roneo Shop",
  street: "Calle Norte 70",
  street1: "Calle Norte 70",
  zipCode: "23650",
  zip_code: "23650",
  city: "Torredonjimeno",
  province: "Jaén",
  state: "Jaén",
  country: "ES",
  countryLabel: "ESPAÑA PENÍNSULA",
  phone: "622063691",
  phoneFormatted: "+34 622 06 36 91",
  email: "1roneoshop@gmail.com"
};

export const DEFAULT_PARCEL_DIMENSIONS = {
  length: 30, // cm
  width: 25,  // cm
  height: 10, // cm
  weight: 0.5 // kg por defecto
};

/**
 * Tabla de mapeo oficial de prefijos de Código Postal español (01 - 52) a Provincias
 */
export const SPAIN_PROVINCES_BY_PREFIX = {
  "01": "Álava", "02": "Albacete", "03": "Alicante", "04": "Almería", "05": "Ávila",
  "06": "Badajoz", "07": "Baleares", "08": "Barcelona", "09": "Burgos", "10": "Cáceres",
  "11": "Cádiz", "12": "Castellón", "13": "Ciudad Real", "14": "Córdoba", "15": "A Coruña",
  "16": "Cuenca", "17": "Girona", "18": "Granada", "19": "Guadalajara", "20": "Gipuzkoa",
  "21": "Huelva", "22": "Huesca", "23": "Jaén", "24": "León", "25": "Lleida",
  "26": "La Rioja", "27": "Lugo", "28": "Madrid", "29": "Málaga", "30": "Murcia",
  "31": "Navarra", "32": "Ourense", "33": "Asturias", "34": "Palencia", "35": "Las Palmas",
  "36": "Pontevedra", "37": "Salamanca", "38": "Santa Cruz de Tenerife", "39": "Cantabria", "40": "Segovia",
  "41": "Sevilla", "42": "Soria", "43": "Tarragona", "44": "Teruel", "45": "Toledo",
  "46": "Valencia", "47": "Valladolid", "48": "Bizkaia", "49": "Zamora", "50": "Zaragoza",
  "51": "Ceuta", "52": "Melilla"
};

// Alias de retrocompatibilidad
export const SPANISH_POSTAL_PREFIXES = SPAIN_PROVINCES_BY_PREFIX;

/**
 * Deduce la provincia a partir de un Código Postal español de 5 dígitos
 */
export function getProvinceFromZip(zipCode) {
  if (!zipCode) return null;
  const clean = String(zipCode).trim().padStart(5, '0');
  const prefix = clean.substring(0, 2);
  return SPAIN_PROVINCES_BY_PREFIX[prefix] || null;
}

/**
 * Comprueba si un código postal pertenece a España Peninsular (excluye Baleares, Canarias, Ceuta y Melilla)
 */
export function isPeninsularZip(zipCode) {
  if (!zipCode) return true;
  const clean = String(zipCode).trim().padStart(5, '0');
  const prefix = clean.substring(0, 2);
  const nonPeninsular = ["07", "35", "38", "51", "52"];
  return !nonPeninsular.includes(prefix);
}

/**
 * Redondea cualquier coste de envío con IVA al tramo ",99€" correspondiente:
 * - Si rawPrice <= 0 (Envío Gratis) -> 0.00
 * - Si rawPrice es 3.45€ o 4.00€ (no supera 4.00€) -> Math.ceil(4.00) - 1 + 0.99 = 3.99€
 * - Si rawPrice es 4.01€ o 4.59€ (supera 4.00€)    -> Math.ceil(4.59) - 1 + 0.99 = 4.99€
 * - Si rawPrice es 5.00€ (no supera 5.00€)         -> Math.ceil(5.00) - 1 + 0.99 = 4.99€
 * - Si rawPrice es 5.15€ (supera 5.00€)            -> Math.ceil(5.15) - 1 + 0.99 = 5.99€
 */
export function roundShippingPriceTo99(rawPriceWithVat) {
  const cleanPrice = Number(parseFloat(rawPriceWithVat).toFixed(2));
  if (isNaN(cleanPrice) || cleanPrice <= 0) {
    return 0;
  }
  const integerBracket = Math.max(0, Math.ceil(cleanPrice) - 1);
  return Number((integerBracket + 0.99).toFixed(2));
}

/**
 * Concatena la dirección y el piso/apartamento de forma limpia e idempotente.
 * Si rawApartment ya está presente o duplicado en rawStreet, evita la duplicación.
 * Garantiza que a Packlink PRO solo viaje una única cadena limpia en street1 (sin street2).
 */
export function buildCleanSingleStreet(rawStreet, rawApartment = '') {
  let street = String(rawStreet || '').trim().replace(/\s+/g, ' ');
  let apt = String(rawApartment || '').trim().replace(/\s+/g, ' ');

  if (!street || street === '-') {
    street = 'Calle Mayor 1';
  }

  if (!apt) {
    return street;
  }

  const escapedApt = apt.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const duplicatedRegex = new RegExp('(?:,\\s*|\\s+)' + escapedApt + '(?:(?:,\\s*|\\s+)' + escapedApt + ')+$', 'i');
  if (duplicatedRegex.test(street)) {
    return street.replace(duplicatedRegex, ', ' + apt);
  }

  const endsWithAptRegex = new RegExp('(?:,\\s*|\\s+)' + escapedApt + '$', 'i');
  if (endsWithAptRegex.test(street)) {
    return street;
  }

  return `${street}, ${apt}`;
}

/**
 * Calcula la siguiente fecha hábil de recogida en formato YYYY/MM/DD exigido por Packlink PRO.
 * Si hoy es viernes o fin de semana, avanza al lunes laboral correspondiente.
 */
export function getNextBusinessDayFormatted() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  if (d.getDay() === 6) { // Sábado -> Lunes (+2)
    d.setDate(d.getDate() + 2);
  } else if (d.getDay() === 0) { // Domingo -> Lunes (+1)
    d.setDate(d.getDate() + 1);
  }
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}/${mm}/${dd}`;
}

const postalCache = new Map();

/**
 * Resuelve la localidad y provincia OFICIALES registradas en Packlink PRO para un Código Postal de España Península.
 * Garantiza que el campo "Ciudad o código postal" de Packlink PRO se rellene automáticamente al 100%.
 */
export async function resolvePacklinkPostalLocation(rawZip, fallbackCity = "", fallbackProvince = "") {
  const cleanZip = String(rawZip || "").replace(/\D/g, "").padStart(5, "0").slice(0, 5);
  const prefix = cleanZip.slice(0, 2);
  const defaultProvince = SPAIN_PROVINCES_BY_PREFIX[prefix] || fallbackProvince || "Jaén";

  // Caso fijo inmutable para nuestro remitente en 23650 Torredonjimeno (Jaén)
  if (cleanZip === "23650") {
    const fixedSenderLoc = {
      zip_code: "23650",
      city: "Torredonjimeno",
      state: "España - Peninsular",
      province: "Jaén",
      country: "ES",
      zone: "ESPAÑA PENÍNSULA",
      postal_zone_id: 65,
      zip_code_id: "bb566bc7-359e-47fb-8f82-dca15a07db78",
      cities: ["Torredonjimeno"]
    };
    postalCache.set(cleanZip, fixedSenderLoc);
    return fixedSenderLoc;
  }

  let resolvedCity = String(fallbackCity || "").trim();
  let resolvedState = defaultProvince;
  let allCitiesForZip = [];

  if (!/^\d{5}$/.test(cleanZip)) {
    return {
      zip_code: "23650",
      city: resolvedCity || "Torredonjimeno",
      state: "España - Peninsular",
      province: resolvedState || "Jaén",
      country: "ES",
      zone: "ESPAÑA PENÍNSULA",
      postal_zone_id: 65,
      zip_code_id: "bb566bc7-359e-47fb-8f82-dca15a07db78",
      cities: ["Torredonjimeno"]
    };
  }

  if (postalCache.has(cleanZip)) {
    const cached = postalCache.get(cleanZip);
    // Si el usuario escribió una ciudad que coincide con una de las localidades válidas del CP, la respetamos con el formato exacto de Packlink
    if (fallbackCity && cached.cities && cached.cities.length > 0) {
      const normUser = fallbackCity.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const matched = cached.cities.find(c => c.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") === normUser);
      if (matched) return { ...cached, city: matched };
    }
    return cached;
  }

  // 1. Consulta oficial a la API de Packlink PRO (/v1/locations/postalcodes)
  const packlinkEndpoints = [
    `/locations/postalcodes?postalzone=65&q=${cleanZip}`,
    `/locations/postalcodes/ES/${cleanZip}`
  ];

  for (const ep of packlinkEndpoints) {
    try {
      const res = await packlinkRequest(ep, { method: 'GET' });
      const rawData = res?.data;
      let list = [];
      if (Array.isArray(rawData)) {
        list = rawData;
      } else if (rawData && typeof rawData === 'object') {
        if (Array.isArray(rawData.postalcodes)) list = rawData.postalcodes;
        else if (rawData.city && rawData.zipcode) list = [rawData];
      }

      if (res.ok && list.length > 0) {
        // Filtrar los registros que correspondan exactamente a este código postal
        const exactMatches = list.filter(item => {
          const itemZip = String(item.zip || item.zip_code || item.zipcode || item.postal_code || item.postalCode || "").trim();
          return !itemZip || itemZip === cleanZip;
        });
        const candidates = exactMatches.length > 0 ? exactMatches : list;
        const cities = candidates
          .map(item => {
            if (typeof item.city === 'object' && item.city?.name) return String(item.city.name).trim();
            if (typeof item.city === 'string' && item.city) return String(item.city).trim();
            if (item.name) return String(item.name).trim();
            if (item.locality) return String(item.locality).trim();
            if (item.text && item.text.includes('-')) {
              const parts = item.text.split('-');
              return parts.slice(1).join('-').trim();
            }
            return '';
          })
          .filter(Boolean);

        if (cities.length > 0) {
          allCitiesForZip = [...new Set(cities)];
          resolvedCity = allCitiesForZip[0];

          const firstCandidate = candidates[0];
          let firstState = "";
          if (typeof firstCandidate.province === 'object' && firstCandidate.province?.name) {
            firstState = String(firstCandidate.province.name).trim();
          } else if (firstCandidate.province) {
            firstState = String(firstCandidate.province).trim();
          } else if (typeof firstCandidate.state === 'object' && firstCandidate.state?.name) {
            firstState = String(firstCandidate.state.name).trim();
          } else if (firstCandidate.state) {
            firstState = String(firstCandidate.state).trim();
          }

          if (firstState && !firstState.toLowerCase().includes("peninsular") && !firstState.toLowerCase().includes("españa")) {
            resolvedState = firstState;
          } else {
            resolvedState = defaultProvince;
          }

          // Si el usuario había escrito una localidad válida, usar la grafía oficial exacta
          if (fallbackCity) {
            const normUser = fallbackCity.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            const exactCityMatch = allCitiesForZip.find(
              c => c.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") === normUser
            );
            if (exactCityMatch) resolvedCity = exactCityMatch;
          }

          const resultObj = {
            zip_code: cleanZip,
            city: resolvedCity,
            state: "España - Peninsular",
            province: resolvedState || defaultProvince,
            country: "ES",
            zone: "ESPAÑA PENÍNSULA",
            postal_zone_id: 65,
            zip_code_id: firstCandidate?.id || null,
            cities: allCitiesForZip
          };
          postalCache.set(cleanZip, resultObj);
          return resultObj;
        }
      }
    } catch (e) {
      // Continuar al siguiente endpoint o al respaldo
    }
  }

  // 2. Respaldo oficial del directorio postal de España (api.zippopotam.us/es/{cp})
  try {
    const zippoRes = await fetch(`https://api.zippopotam.us/es/${cleanZip}`);
    if (zippoRes.ok) {
      const zippoData = await zippoRes.json();
      if (Array.isArray(zippoData?.places) && zippoData.places.length > 0) {
        allCitiesForZip = zippoData.places.map(p => String(p["place name"] || "").trim()).filter(Boolean);
        if (allCitiesForZip.length > 0) {
          resolvedCity = allCitiesForZip[0];
          const resultObj = {
            zip_code: cleanZip,
            city: resolvedCity,
            state: "España - Peninsular",
            province: defaultProvince,
            country: "ES",
            zone: "ESPAÑA PENÍNSULA",
            postal_zone_id: 65,
            zip_code_id: null,
            cities: allCitiesForZip
          };
          postalCache.set(cleanZip, resultObj);
          return resultObj;
        }
      }
    }
  } catch (e) {}

  const finalObj = {
    zip_code: cleanZip,
    city: resolvedCity || defaultProvince,
    state: "España - Peninsular",
    province: resolvedState || defaultProvince,
    country: "ES",
    zone: "ESPAÑA PENÍNSULA",
    postal_zone_id: 65,
    zip_code_id: null,
    cities: [resolvedCity || defaultProvince]
  };
  postalCache.set(cleanZip, finalObj);
  return finalObj;
}

// Retrocompatibilidad con la firma anterior resolvePacklinkPostalZone
export async function resolvePacklinkPostalZone(zipCode, fallbackCity = "") {
  const loc = await resolvePacklinkPostalLocation(zipCode, fallbackCity);
  return {
    officialCity: loc.city,
    officialProvince: loc.state,
    postalZoneId: 65,
    city: loc.city,
    province: loc.state,
    zipCode: loc.zip_code
  };
}

/**
 * Función de compatibilidad: las claves ya no residen en el cliente ni en los ajustes.
 * Siempre retorna una cadena vacía; la autenticación con Packlink se realiza exclusivamente en Cloud Functions.
 */
export function getActivePacklinkApiKey() {
  return "";
}

/**
 * Ejecuta una petición segura contra la API de envíos a través del backend Cloud Functions Proxy (/api/packlink).
 * No contiene ni envía ninguna clave Packlink; utiliza Firebase ID Token para rutas protegidas (envíos/POST).
 */
export async function packlinkRequest(endpoint, { method = 'GET', body = null } = {}) {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const isPost = (method || 'GET').toUpperCase() === 'POST';
  const isShipments = cleanEndpoint.startsWith('/shipments');
  const requiresAdminAuth = isPost || isShipments;

  let idToken = null;
  if (requiresAdminAuth) {
    if (typeof window !== 'undefined' && auth?.currentUser) {
      try {
        idToken = await auth.currentUser.getIdToken();
      } catch (e) {
        console.warn("[packlinkRequest] Error obteniendo Firebase ID Token:", e);
      }
    }
    if (!idToken) {
      return {
        ok: false,
        status: 401,
        error: "Acceso no autorizado: Se requiere sesión de administrador para gestionar envíos.",
        channel: 'client-auth-guard'
      };
    }
  }

  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  };

  if (idToken) {
    headers['Authorization'] = `Bearer ${idToken}`;
  }

  const fetchOptions = {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  };

  const hostname = (typeof window !== 'undefined' && window.location) ? window.location.hostname : '';
  const isLocal = hostname === '127.0.0.1' || hostname === 'localhost';

  const attempts = [
    // 1. Canal principal oficial: Cloud Functions Proxy vía Firebase Hosting
    {
      name: 'firebase-proxy',
      url: `/api/packlink${cleanEndpoint}`
    }
  ];

  if (isLocal) {
    // 2. Canal de desarrollo local opcional (node local-proxy.js)
    attempts.push({
      name: 'local-micro-proxy',
      url: `http://127.0.0.1:3001/api/packlink${cleanEndpoint}`
    });
  }

  let lastError = null;

  for (const attempt of attempts) {
    try {
      const response = await fetch(attempt.url, fetchOptions);
      const rawText = await response.text();

      // Si un rewrite devolviera HTML (ej. 404 de hosting fallback a index.html), saltar al siguiente intento
      if (rawText.trim().startsWith('<!DOCTYPE') || rawText.trim().startsWith('<html')) {
        continue;
      }

      let parsedData = null;
      try {
        parsedData = rawText ? JSON.parse(rawText) : {};
      } catch (e) {
        parsedData = { raw: rawText };
      }

      if (!response.ok) {
        const errorMsg = parsedData?.message || parsedData?.error || (Array.isArray(parsedData?.messages) ? parsedData.messages.join(', ') : null) || `HTTP ${response.status}`;
        const err = new Error(errorMsg);
        err.status = response.status;
        err.details = parsedData;
        throw err;
      }

      return {
        ok: true,
        status: response.status,
        channel: attempt.name,
        data: parsedData
      };
    } catch (err) {
      lastError = err;
      if (err.status && [400, 401, 403, 404, 405, 422].includes(err.status)) {
        break;
      }
    }
  }

  return {
    ok: false,
    status: lastError?.status || 0,
    error: lastError?.message || 'No se pudo conectar con el servicio de envíos',
    details: lastError?.details || null
  };
}


/**
 * Obtiene exclusivamente las opciones oficiales de Correos y Correos Express con 21% de IVA incluido
 * y redondeo estricto al tramo ",99€" (roundShippingPriceTo99).
 */
export async function getCorreosShippingOptions({
  fromZip = '23650',
  toZip = '28001',
  weightKg = 0.5,
  length = 30,
  width = 25,
  height = 10,
  apiKey = null
} = {}) {
  const cleanFromZip = String(fromZip || '23650').trim().padStart(5, '0');
  const cleanToZip = String(toZip || '').trim().padStart(5, '0');
  const safeWeight = Math.max(0.1, parseFloat(weightKg) || 0.5);

  // Valores de respaldo estrictamente redondeados al tramo ,99€ validados con la API oficial
  const fallbackCorreos = {
    id: 20679,
    serviceId: 20679,
    carrier: "Correos",
    carrierName: "Correos",
    serviceName: "Correos · Paq Estándar Domicilio",
    officialName: "Paq Standard Domicilio-Domicilio",
    transitDays: 3,
    transitHours: "48-72h",
    basePrice: 4.08,
    taxPrice: 0.86,
    priceWithVat: 4.99,
    costWithVat: 4.99,
    currency: "EUR",
    dropoff: false,
    delivery_to_parcelshop: false,
    deliveryToDoor: true,
    isFreeEligible: true
  };

  const fallbackExpress = {
    id: 20571,
    serviceId: 20571,
    carrier: "Correos Express",
    carrierName: "Correos Express",
    serviceName: "Correos Express · Entrega Urgente 24h",
    officialName: "Paq 24",
    transitDays: 1,
    transitHours: "24h",
    basePrice: 4.43,
    taxPrice: 0.93,
    priceWithVat: 5.99,
    costWithVat: 5.99,
    currency: "EUR",
    dropoff: false,
    delivery_to_parcelshop: false,
    deliveryToDoor: true,
    isFreeEligible: false
  };

  if (!cleanToZip || cleanToZip.length !== 5 || !/^\d{5}$/.test(cleanToZip)) {
    return {
      ok: true,
      channel: 'fallback',
      correos: fallbackCorreos,
      correosExpress: fallbackExpress,
      services: [fallbackCorreos, fallbackExpress]
    };
  }

  const queryParams = new URLSearchParams({
    'from[country]': 'ES',
    'from[zip]': cleanFromZip,
    'to[country]': 'ES',
    'to[zip]': cleanToZip,
    'packages[0][weight]': safeWeight.toFixed(2),
    'packages[0][length]': String(length),
    'packages[0][width]': String(width),
    'packages[0][height]': String(height)
  });

  const res = await packlinkRequest(`/services?${queryParams.toString()}`, {
    method: 'GET',
    apiKey
  });

  if (!res.ok) {
    return {
      ok: false,
      error: res.error,
      correos: fallbackCorreos,
      correosExpress: fallbackExpress,
      services: [fallbackCorreos, fallbackExpress]
    };
  }

  const rawServices = Array.isArray(res.data) ? res.data : (res.data?.services || []);
  
  // Filtrar servicios de Correos y Correos Express
  const correosServices = rawServices.filter(s => {
    const cName = (s.carrier_name || s.carrier || '').toLowerCase();
    const sName = (s.name || '').toLowerCase();
    return cName.includes('correos') || sName.includes('correos');
  });

  // Filtrar exclusivamente servicios con entrega en domicilio del cliente (delivery_to_parcelshop === false)
  const homeDeliveryServices = correosServices.filter(s => s.delivery_to_parcelshop === false);
  const candidateList = homeDeliveryServices.length > 0 ? homeDeliveryServices : correosServices;

  // 1. Mejor opción de Correos (Paq Estándar Domicilio-Domicilio, id 20679 preferente)
  let bestCorreos = candidateList.find(s => {
    const cName = (s.carrier_name || s.carrier || '').toLowerCase();
    return cName === 'correos' && s.delivery_to_parcelshop === false && (s.dropoff === false || s.id === 20679);
  }) || candidateList.find(s => (s.carrier_name || s.carrier || '').toLowerCase() === 'correos' && s.delivery_to_parcelshop === false);

  // 2. Mejor opción de Correos Express (Paq 24, id 20571 preferente)
  let bestExpress = candidateList.find(s => {
    const cName = (s.carrier_name || s.carrier || '').toLowerCase();
    return cName.includes('express') && s.delivery_to_parcelshop === false;
  }) || candidateList.find(s => (s.carrier_name || s.carrier || '').toLowerCase().includes('express'));

  function formatService(s, fallback, label, transit, isFreeEligible) {
    if (!s) return fallback;
    const base = parseFloat(s.price?.base_price || s.price?.total_price || fallback.basePrice);
    const tax = parseFloat(s.price?.tax_price || 0);
    const total = parseFloat(s.price?.total_price || 0);

    // Si total_price ya incluye IVA (tax_price > 0 y total_price > base_price), lo usamos; si no, base * 1.21
    const rawWithVat = (tax > 0 && total > base)
      ? total
      : (base * 1.21);

    // Aplicación matemática estricta del tramo ,99€
    const finalPriceWithVat = roundShippingPriceTo99(rawWithVat);

    return {
      id: Number(s.id || s.service_id || fallback.id),
      serviceId: Number(s.id || s.service_id || fallback.id),
      carrier: s.carrier_name || fallback.carrier,
      carrierName: s.carrier_name || fallback.carrier,
      serviceName: label,
      officialName: s.name || fallback.serviceName,
      transitDays: s.transit_days || fallback.transitDays,
      transitHours: transit,
      basePrice: Number(base.toFixed(2)),
      taxPrice: Number((finalPriceWithVat - base).toFixed(2)),
      priceWithVat: finalPriceWithVat,
      costWithVat: finalPriceWithVat,
      rawPriceWithVat: Number(rawWithVat.toFixed(2)),
      currency: s.price?.currency || 'EUR',
      dropoff: Boolean(s.dropoff),
      deliveryToDoor: Boolean(s.delivery_to_door ?? true),
      isFreeEligible
    };
  }

  const formattedCorreos = formatService(
    bestCorreos,
    fallbackCorreos,
    "Correos · Paq Estándar Domicilio",
    "48/72h",
    true
  );

  const formattedExpress = formatService(
    bestExpress,
    fallbackExpress,
    "Correos Express · Entrega Urgente 24h",
    "24h",
    false
  );

  return {
    ok: true,
    channel: res.channel,
    correos: formattedCorreos,
    correosExpress: formattedExpress,
    services: [formattedCorreos, formattedExpress]
  };
}

/**
 * Consulta en tiempo real las tarifas oficiales de transportistas disponibles (GET /v1/services)
 */
export async function getPacklinkRates({
  fromZip = '29001',
  fromCountry = 'ES',
  toZip = '28001',
  toCountry = 'ES',
  weight = 0.5,
  length = 30,
  width = 25,
  height = 10,
  apiKey = null
} = {}) {
  const cleanFromZip = String(fromZip).trim().padStart(5, '0');
  const cleanToZip = String(toZip).trim().padStart(5, '0');
  const safeWeight = Math.max(0.1, parseFloat(weight) || 0.5);

  const queryParams = new URLSearchParams({
    'from[country]': fromCountry.toUpperCase(),
    'from[zip]': cleanFromZip,
    'to[country]': toCountry.toUpperCase(),
    'to[zip]': cleanToZip,
    'packages[0][weight]': safeWeight.toFixed(2),
    'packages[0][length]': String(length),
    'packages[0][width]': String(width),
    'packages[0][height]': String(height)
  });

  const res = await packlinkRequest(`/services?${queryParams.toString()}`, {
    method: 'GET',
    apiKey
  });

  if (!res.ok) {
    return {
      ok: false,
      error: res.error,
      services: [],
      raw: res
    };
  }

  const rawServices = Array.isArray(res.data) ? res.data : (res.data?.services || []);
  
  const formattedServices = rawServices.map(srv => {
    const basePrice = parseFloat(srv.price?.base_price || srv.price?.total_price || 0);
    const taxPrice = parseFloat(srv.price?.tax_price || 0);
    const totalPrice = parseFloat(srv.price?.total_price || 0);

    const priceWithVat = (taxPrice > 0 && totalPrice > basePrice)
      ? Number(totalPrice.toFixed(2))
      : Number((basePrice * 1.21).toFixed(2));

    return {
      serviceId: Number(srv.id || srv.service_id),
      carrierName: srv.carrier_name || srv.carrier || 'Transportista Exprés',
      serviceName: srv.name || srv.service_name || 'Entrega Estándar',
      transitHours: srv.transit_hours || (srv.transit_days ? `${srv.transit_days * 24}h` : '24-48h'),
      transitDays: srv.transit_days || (srv.transit_hours ? Math.ceil(parseInt(srv.transit_hours, 10) / 24) : 2),
      dropoff: Boolean(srv.dropoff),
      deliveryToDoor: Boolean(srv.delivery_to_door ?? true),
      basePrice,
      taxPrice,
      price: priceWithVat,
      currency: srv.price?.currency || 'EUR',
      logoUrl: srv.carrier_logo || null,
      raw: srv
    };
  }).sort((a, b) => a.price - b.price);

  return {
    ok: true,
    channel: res.channel,
    count: formattedServices.length,
    services: formattedServices
  };
}

/**
 * Construye el payload exacto para la creación de envíos según la API oficial POST /v1/shipments
 * Garantiza datos inmutables del remitente (Nerea Cortes Muñoz en Torredonjimeno 23650)
 * y resolución estricta de Código Postal y Ciudad oficial del destinatario para evitar errores en Packlink PRO.
 */
export async function buildPacklinkShipmentPayload(order, settings = {}, overrides = {}) {
  const cust = order?.customer || {};
  const custNameParts = String(cust.firstName || "Cliente").trim().split(/\s+/);
  const custFirstName = custNameParts[0] || "Cliente";
  const custSurname = (cust.lastName || custNameParts.slice(1).join(" ") || "Cliente").trim();

  const totalWeight = Math.max(0.2, parseFloat(overrides.weight || order?.totalWeightKg || settings?.packlinkParcel?.defaultWeight || 0.5));
  const length = parseInt(overrides.length || settings?.packlinkParcel?.length || DEFAULT_PARCEL_DIMENSIONS.length, 10);
  const width = parseInt(overrides.width || settings?.packlinkParcel?.width || DEFAULT_PARCEL_DIMENSIONS.width, 10);
  const height = parseInt(overrides.height || settings?.packlinkParcel?.height || DEFAULT_PARCEL_DIMENSIONS.height, 10);

  // 1. Remitente: 100% fijo e inmutable en Torredonjimeno (Jaén), España Península
  const senderLoc = await resolvePacklinkPostalLocation("23650", "Torredonjimeno", "Jaén");

  // 2. Destinatario: resolución estricta del par (zip_code, city) en el catálogo de Packlink
  const rawToZip = overrides.toZip || cust.zipCode || cust.zip_code || cust.postalCode || "28001";
  const recipientLoc = await resolvePacklinkPostalLocation(rawToZip, overrides.officialCity || cust.city, overrides.officialProvince || cust.province);

  const cleanCustPhone = String(cust.phone || "").replace(/^\+?34\s*/, "").replace(/\D/g, "").slice(0, 9) || FIXED_SENDER_ADDRESS.phone;

  // Construcción de la calle de destino limpia sin duplicación de piso ni street2
  const rawRecipientStreet = cust.street || cust.street1 || "";
  const rawRecipientApartment = cust.apartment || "";
  const cleanRecipientStreet = buildCleanSingleStreet(rawRecipientStreet, rawRecipientApartment);

  // Servicio y transportista asignados
  let targetServiceId = overrides.service_id || overrides.serviceId || order?.shipping?.serviceId || order?.packlink?.serviceId || null;
  let targetCarrier = overrides.carrierName || order?.shipping?.carrier || order?.packlink?.carrierName || "Correos Express";
  let targetService = overrides.serviceName || order?.shipping?.serviceName || order?.packlink?.serviceName || "Paq 24";

  if (!targetServiceId) {
    const isExpress = /express/i.test(targetCarrier || '') || /express/i.test(targetService || '');
    targetServiceId = isExpress ? 20571 : 20679;
    targetCarrier = isExpress ? "Correos Express" : "Correos";
    targetService = isExpress ? "Paq 24" : "Paq Standard Domicilio-Domicilio";
  }

  const collectionDate = overrides.collection_date || getNextBusinessDayFormatted();
  const collectionTime = overrides.collection_time || (/express/i.test(targetCarrier || '') ? "09:00-15:00" : "09:00-12:00");

  const payload = {
    service: targetService,
    carrier: targetCarrier,
    service_id: Number(targetServiceId),
    collection_date: collectionDate,
    collection_time: collectionTime,
    insurance: { amount: 0, insurance_selected: false },
    print_in_store_selected: false,
    selected_products: { insurance: null, voucher: null, ddp: { is_selected: null } },
    from: {
      name: FIXED_SENDER_ADDRESS.name,
      surname: FIXED_SENDER_ADDRESS.surname,
      company: FIXED_SENDER_ADDRESS.company,
      street1: FIXED_SENDER_ADDRESS.street1,
      city: "Torredonjimeno",
      state: "España - Peninsular",
      zip_code: "23650",
      country: "ES",
      phone: FIXED_SENDER_ADDRESS.phone,
      email: FIXED_SENDER_ADDRESS.email
    },
    to: {
      name: custFirstName,
      surname: custSurname,
      company: null,
      street1: cleanRecipientStreet,
      city: recipientLoc.city,
      state: "España - Peninsular",
      zip_code: recipientLoc.zip_code,
      country: "ES",
      phone: cleanCustPhone,
      email: (cust.email || FIXED_SENDER_ADDRESS.email).trim()
    },
    packages: [
      {
        weight: Number(totalWeight.toFixed(2)),
        length: length,
        width: width,
        height: height
      }
    ],
    content: overrides.content || `Ropa y calzado Roneo Shop - Pedido #${order?.orderNumber || 'TEST'}`,
    contentvalue: Number(parseFloat(order?.subtotal || order?.total || 29.95).toFixed(2)),
    content_second_hand: false,
    source: "roneoshop_es",
    additional_data: {
      order_id: String(order?.orderNumber || `TEST-${Date.now()}`),
      postal_zone_id_from: "65",
      postal_zone_id_to: "65",
      postal_zone_name_from: "España - Peninsular",
      postal_zone_name_to: "España - Peninsular",
      zip_code_id_from: "bb566bc7-359e-47fb-8f82-dca15a07db78",
      zip_code_id_to: recipientLoc.zip_code_id || "6dc37e75-5d42-4e7f-8e49-0fe114528b69"
    }
  };

  return payload;
}

/**
 * Crea un borrador real de envío en la cuenta de Packlink PRO (POST /v1/shipments).
 * Auto-resuelve service_id numérico de Correos o Correos Express y par (zip_code, city) oficial.
 */
export async function createPacklinkShipment(order, settings = {}, overrides = {}) {
  const cust = order?.customer || {};
  const toZip = String(cust.zipCode || cust.zip || '28001').trim().padStart(5, '0');
  const fromZip = '23650'; // Siempre fijo Torredonjimeno
  const weightVal = Math.max(0.2, parseFloat(overrides.weight || order?.totalWeightKg || 0.5));

  let serviceId = overrides.service_id || overrides.serviceId || order?.shipping?.serviceId || order?.packlink?.serviceId;
  let carrierName = overrides.carrierName || order?.shipping?.carrier || order?.packlink?.carrierName;
  let serviceName = overrides.serviceName || order?.shipping?.serviceName || order?.packlink?.serviceName;

  // Si no tenemos service_id válido, cotizamos con origen 23650 y destino cliente
  if (!serviceId) {
    try {
      const optionsRes = await getCorreosShippingOptions({
        fromZip,
        toZip,
        weightKg: weightVal
      });

      if (optionsRes.ok) {
        const wantsExpress = /express/i.test(carrierName || '') || /express/i.test(serviceName || '');
        const matched = wantsExpress ? optionsRes.correosExpress : optionsRes.correos;

        if (matched && matched.id) {
          serviceId = matched.id;
          carrierName = matched.carrier;
          serviceName = matched.officialName || matched.serviceName;
        }
      }
    } catch (err) {
      console.warn("[createPacklinkShipment] Error auto-resolviendo tarifas Correos:", err);
    }
  }

  // Fallback seguro de service_id si la API no devolviera uno
  if (!serviceId) {
    serviceId = /correos\s*express/i.test(carrierName || '') ? 20571 : 20679;
  }

  // Resolución oficial de localidad receptora
  const recipientLoc = await resolvePacklinkPostalLocation(toZip, cust.city, cust.province);

  const mergedOverrides = {
    ...overrides,
    service_id: Number(serviceId),
    carrierName,
    serviceName,
    officialCity: recipientLoc.city,
    officialProvince: recipientLoc.state,
    toZip: recipientLoc.zip_code
  };

  const payload = await buildPacklinkShipmentPayload(order, settings, mergedOverrides);

  const res = await packlinkRequest('/shipments', {
    method: 'POST',
    body: payload
  });

  if (res.ok && res.data?.reference) {
    return {
      ok: true,
      reference: res.data.reference,
      channel: res.channel,
      serviceId: Number(serviceId),
      carrierName,
      serviceName,
      payload,
      data: res.data
    };
  }

  return {
    ok: false,
    error: res.error || 'Error al crear el envío en Packlink PRO',
    details: res.details,
    channel: res.channel,
    payload
  };
}

/**
 * Consulta el estado real y tracking de un envío existente en Packlink PRO (GET /v1/shipments/{reference})
 */
export async function getPacklinkShipmentStatus(reference, apiKey = null) {
  if (!reference) {
    return { ok: false, error: 'Referencia de envío requerida' };
  }
  const cleanRef = String(reference).trim();
  const res = await packlinkRequest(`/shipments/${encodeURIComponent(cleanRef)}`, {
    method: 'GET',
    apiKey
  });

  if (res.ok && res.data) {
    const d = res.data;
    return {
      ok: true,
      reference: d.reference || cleanRef,
      state: d.state || 'DRAFT',
      carrier: d.carrier || d.service?.carrier_name || 'Correos Express',
      serviceName: d.service?.name || 'Servicio Domicilio',
      trackingCodes: d.tracking_codes || [],
      trackUrl: d.track_url || d.tracking_url || `https://pro.packlink.es/private/shipments/${cleanRef}`,
      price: d.price?.total_price || null,
      channel: res.channel,
      data: d
    };
  }

  return {
    ok: false,
    error: res.error,
    details: res.details
  };
}

/**
 * Descarga las etiquetas oficiales en PDF del envío (GET /v1/shipments/{reference}/labels)
 */
export async function getPacklinkShipmentLabels(reference, apiKey = null) {
  if (!reference) return { ok: false, error: 'Referencia requerida' };
  const cleanRef = String(reference).trim();

  const res = await packlinkRequest(`/shipments/${encodeURIComponent(cleanRef)}/labels`, {
    method: 'GET',
    apiKey
  });

  if (res.ok && Array.isArray(res.data) && res.data.length > 0) {
    return {
      ok: true,
      labels: res.data,
      channel: res.channel
    };
  }

  return {
    ok: false,
    error: res.error || 'Etiquetas aún no generadas. El envío debe confirmarse y pagarse previamente en Packlink PRO.',
    details: res.details
  };
}
