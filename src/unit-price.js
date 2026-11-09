import { parseMoney } from "./money.js";
import { bestPromo } from "./banks.js";

const SIN_DATO = { group: "sin_dato", factor: 1, drained: false };

function clean(text) {
  return String(text ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

// Lleva el nombre de unidad de Coto a kg, L, unidad o sin_dato.
// factor: cuánto multiplicar formatPrice para llegar a 1 kg / 1 L / 1 unidad.
export function normalizeUnit(format, qty) {
  const name = clean(format);
  if (!name || !qty) return SIN_DATO;
  const drained = name.includes("escurrido");
  const base = name.replace("escurrido", "").trim();

  if (base === "kilo" || base === "kilogramo") return { group: "kg", factor: 1, drained };
  if (base === "gramos" || base === "gramo") return { group: "kg", factor: 1000 / qty, drained };
  if (base === "litro") return { group: "L", factor: 1, drained };
  if (base === "mililitros" || base === "mililitro") return { group: "L", factor: 1000 / qty, drained };
  if (base === "unidad") return { group: "unidad", factor: 1, drained };
  return SIN_DATO;
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
export function unitPrice(data, store, promos = [], day = 0) {
  const unit = normalizeUnit(data?.product_format, data?.product_format_quantity);
  const base = pickStorePrice(data, store);
  const price = finalPrice(data, store);
  if (unit.group === "sin_dato" || !base?.listPrice || !base?.formatPrice || !price) {
    return { group: "sin_dato", value: null, drained: false, take: 1, bankValue: null, bankName: null };
  }
  const value = round2(price * (base.formatPrice / base.listPrice) * unit.factor);
  const promo = bestPromo(promos, day, isOnSale(data));
  return {
    group: unit.group,
    value,
    drained: unit.drained,
    take: takeQty(data, store),
    bankValue: promo ? round2(value * (1 - promo.percent / 100)) : null,
    bankName: promo ? promo.bank : null,
  };
}
