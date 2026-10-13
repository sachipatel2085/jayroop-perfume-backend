/**
 * Shipping engine – one place that decides the shipping charge, delivery promise and COD
 * availability for a bag. Used by the cart preview, checkout and PhonePe order creation.
 *
 * Simple mode (default): flat fee below the free-shipping limit (Settings › Shipping).
 * Zone mode: LOCAL (same state as the business) · NATIONAL · REMOTE (NE, J&K, Ladakh, islands),
 * each with its own fee, free-shipping limit, delivery days and COD switch.
 * PIN code rules: blocked PINs (no delivery) and COD-blocked PINs (prepaid only), matched by prefix.
 */
import { canonicalStateName } from '../utils/indiaStates.js';

const ZONE_ORDER = ['LOCAL', 'NATIONAL', 'REMOTE'];
const norm = (s = '') => canonicalStateName(s || '').toLowerCase();
const matchesPin = (pin, list = []) => {
  const p = String(pin || '').replace(/\D/g, '');
  return Boolean(p) && list.some((rule) => {
    const r = String(rule || '').replace(/\D/g, '');
    return r && p.startsWith(r);
  });
};
const daysText = (min, max) => (min === max ? `${max} business days` : `${min}–${max} business days`);

/** Which zone does this delivery state fall in? (null state → NATIONAL estimate) */
export const zoneFor = (store, state) => {
  const s = store.shipping || {};
  if (!state) return 'NATIONAL';
  if (norm(state) === norm(store.business?.state)) return 'LOCAL';
  if ((s.remoteStates || []).some((r) => norm(r) === norm(state))) return 'REMOTE';
  return 'NATIONAL';
};

/**
 * @param {Object} p
 * @param {Object} p.store       store settings document
 * @param {number} p.subtotal    goods value (GST-inclusive in inclusive mode)
 * @param {number} p.units       total units in the bag
 * @param {Object} p.address     { state, postalCode } – optional (cart preview)
 * @param {boolean} p.surfaceOnly bag contains surface-only items (perfume)
 */
export const computeShipping = ({ store, subtotal = 0, units = 0, address = null, surfaceOnly = false }) => {
  const s = store.shipping || {};
  const globalFree = s.freeShippingEnabled === false ? null : Number(store.freeShippingThreshold ?? 999);
  const extraUnitFee = Number(s.additionalItemFee || 0) * Math.max(0, units - 1);
  const dispatch = Number(s.dispatchDays ?? 1);
  const surfaceExtra = surfaceOnly ? Number(s.surfaceExtraDays ?? 2) : 0;
  const pin = address?.postalCode || '';

  let zoneKey = null;
  let zoneLabel = '';
  let baseFee = Number(store.flatShippingFee ?? 100);
  let freeAbove = globalFree;
  let deliveryText = surfaceOnly ? store.surfaceDeliveryText || store.estimatedDeliveryText : store.estimatedDeliveryText;
  let codByZone = true;

  if (s.zoneRatesEnabled && Array.isArray(s.zones) && s.zones.length) {
    zoneKey = zoneFor(store, address?.state);
    const zone = s.zones.find((z) => z.key === zoneKey) || s.zones.find((z) => z.key === 'NATIONAL') || s.zones[0];
    zoneKey = zone.key;
    zoneLabel = zone.label || zone.key;
    baseFee = Number(zone.fee || 0);
    if (s.freeShippingEnabled !== false) freeAbove = zone.freeAbove === null || zone.freeAbove === undefined ? globalFree : Number(zone.freeAbove);
    const min = Number(zone.minDays || 0) + dispatch + surfaceExtra;
    const max = Math.max(min, Number(zone.maxDays || 0) + dispatch + surfaceExtra);
    deliveryText = daysText(min, max);
    codByZone = zone.codAvailable !== false;
  }

  const isFree = subtotal <= 0 || (freeAbove !== null && freeAbove >= 0 && subtotal >= freeAbove);
  const shipping = isFree ? 0 : Math.round((baseFee + extraUnitFee) * 100) / 100;
  const deliverable = !matchesPin(pin, s.blockedPincodes);
  const codPinOk = !matchesPin(pin, s.codBlockedPincodes);

  return {
    shipping,
    shippingZone: zoneKey,
    shippingZoneLabel: zoneLabel,
    shippingEstimated: !address?.state, // true while the customer hasn't entered an address yet
    freeShippingThreshold: freeAbove,
    amountToFreeShipping: !isFree && freeAbove !== null ? Math.max(0, Math.round((freeAbove - subtotal) * 100) / 100) : 0,
    estimatedDeliveryText: deliveryText,
    deliverable,
    codAvailableForAddress: codByZone && codPinOk,
    codUnavailableReason: !codByZone ? `Cash on Delivery is not available for ${zoneLabel}.` : !codPinOk ? `Cash on Delivery is not available for PIN ${pin}.` : '',
    shippingPolicyNote: s.shippingPolicyNote || '',
  };
};

export const SHIPPING_ZONE_KEYS = ZONE_ORDER;
