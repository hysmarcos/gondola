import { parseMoney } from "./money.js";

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

export function unitPrice(data, store) {
  const unit = normalizeUnit(data?.product_format, data?.product_format_quantity);
  const base = pickStorePrice(data, store);
  const price = finalPrice(data, store);
  if (unit.group === "sin_dato" || !base?.listPrice || !base?.formatPrice || !price) {
    return { group: "sin_dato", value: null, drained: false };
  }
  const value = price * (base.formatPrice / base.listPrice) * unit.factor;
  return { group: unit.group, value: Math.round(value * 100) / 100, drained: unit.drained };
}
