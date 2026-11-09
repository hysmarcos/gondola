import { parseMoney } from "./money.js";
import { bestPromo } from "./banks.js";
import { paperMetric } from "./paper.js";

const SIN_DATO = { group: "sin_dato", factor: 1, drained: false };

function clean(text) {
  return String(text ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

// Lleva el nombre de unidad de Coto a kg, L, unidad, m2, m o sin_dato.
// factor: cuánto multiplicar formatPrice para llegar a 1 kg / 1 L / 1 unidad / 1 m² / 1 m.
export function normalizeUnit(format, qty) {
  const name = clean(format);
  if (!name || !qty) return SIN_DATO;
  const drained = /escurridos?/.test(name);
  const base = name.replace(/escurridos?/, "").trim();

  if (base === "kilo" || base === "kilogramo") return { group: "kg", factor: 1, drained };
  if (base === "gramos" || base === "gramo") return { group: "kg", factor: 1000 / qty, drained };
  if (base === "litro") return { group: "L", factor: 1, drained };
  if (base === "mililitros" || base === "mililitro") return { group: "L", factor: 1000 / qty, drained };
  if (base === "cubicos" || base === "cubico") return { group: "L", factor: 1000 / qty, drained };
  if (base === "unidad") return { group: "unidad", factor: 1, drained };
  if (base === "cuadrado") return { group: "m2", factor: 1, drained };
  if (base === "metro") return { group: "m", factor: 1, drained };
  return SIN_DATO;
}

// Pesables ("X Kg") que vienen sin formato: el precio de lista ya es por kilo.
function isWeighable(data) {
  return !data?.product_format && (Number(data?.product_weighable) === 1 || data?.product_unit_of_measure === "KGS");
}

export function pickStorePrice(data, store) {
  const prices = data?.price ?? [];
  const entry = prices.find((p) => p.store === store) ?? prices[0];
  if (!entry) return null;
  return { listPrice: entry.listPrice, formatPrice: entry.formatPrice };
}

// El precio más bajo pagando una sola vez: lista, oferta o medio de pago en 1 cuota.
export function finalPrice(data, store) {
  const base = pickStorePrice(data, store);
  const candidates = [parseMoney(base?.listPrice)];
  for (const d of data?.discounts ?? []) candidates.push(parseMoney(d.discountPrice));
  for (const m of data?.discounts_payment_methods ?? []) {
    if (String(m.cantidadCuotas).trim() === "1") candidates.push(parseMoney(m.precioCuota));
  }
  const valid = candidates.filter((n) => n !== null && n > 0);
  return valid.length ? Math.min(...valid) : null;
}

export function isOnSale(data) {
  return (data?.discounts ?? []).length > 0;
}

// Unidades que hay que llevar para pagar el precio final ("Llevando 3" → 3).
export function takeQty(data, store) {
  const price = finalPrice(data, store);
  for (const d of data?.discounts ?? []) {
    const n = String(d.takingText ?? "").match(/Llevando\s+(\d+)/i);
    const p = parseMoney(d.discountPrice);
    if (n && p !== null && price !== null && Math.abs(p - price) < 0.01) return Number(n[1]);
  }
  return 1;
}

const round2 = (n) => Math.round(n * 100) / 100;

// promos: las promos bancarias elegidas; day: 0 = domingo.
const EMPTY = { group: "sin_dato", value: null, drained: false, take: 1, note: null, bankValue: null, bankName: null };

// Grupo y precio por unidad (sin banco).
function measure(data, store) {
  const price = finalPrice(data, store);
  const base = pickStorePrice(data, store);
  if (!price || !base?.listPrice) return null;
  if (isWeighable(data)) return { group: "kg", value: price, drained: false, note: null };

  const unit = normalizeUnit(data?.product_format, data?.product_format_quantity);
  if (unit.group === "sin_dato") return null;
  const paper = unit.group === "m2" || unit.group === "m" ? paperMetric(data?.sku_display_name) : null;
  if (paper?.divisor) return { group: paper.group, value: price / paper.divisor, drained: false, note: paper.note };
  if (!base.formatPrice) return null;
  return {
    group: unit.group,
    value: price * (base.formatPrice / base.listPrice) * unit.factor,
    drained: unit.drained,
    note: paper?.note ?? null,
  };
}

export function unitPrice(data, store, promos = [], day = 0) {
  const m = measure(data, store);
  if (!m) return { ...EMPTY };
  const value = round2(m.value);
  const promo = bestPromo(promos, day, isOnSale(data));
  return {
    group: m.group,
    value,
    drained: m.drained,
    note: m.note,
    take: takeQty(data, store),
    bankValue: promo ? round2(value * (1 - promo.percent / 100)) : null,
    bankName: promo ? promo.bank : null,
  };
}
