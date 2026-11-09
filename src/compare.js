// Datos de Coto para comparar contra otros supermercados por código de barras (EAN).
import { finalPrice, takeQty } from "./unit-price.js";

// EAN válido: 8 a 14 dígitos y no todo ceros. Si no, null.
export function validEan(value) {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  return /^\d{8,14}$/.test(s) && !/^0+$/.test(s) ? s : null;
}

// { ean, cmp }: cmp es el precio final de Coto y las unidades que hay que llevar.
// Es el mismo precio de un paquete que muestra la tarjeta (label.price, sin banco).
// opts: los mismos de unitPrice ({ comunidad: false } deja afuera Comunidad).
// Sin cmp si no hay EAN, si el producto es pesable o si no hay precio.
export function compareFields(data, store, opts = {}) {
  const ean = validEan(data?.product_main_ean);
  const weighable = Number(data?.product_weighable) === 1 || data?.product_unit_of_measure === "KGS";
  if (!ean || weighable) return { ean, cmp: null };
  const unit = finalPrice(data, store, opts);
  if (unit === null) return { ean, cmp: null };
  return { ean, cmp: { unit, qty: takeQty(data, store, opts) } };
}

// Compara el precio unitario de Coto con el de otro súper; tolerancia de 1%.
export function classify(cotoUnit, otherUnit) {
  if (otherUnit < cotoUnit * 0.99) return "lower";
  if (otherUnit > cotoUnit * 1.01) return "higher";
  return "equal";
}
