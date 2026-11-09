import { parseMoney } from "./money.js";
import { bestPromo } from "./banks.js";
import { paperMetric } from "./paper.js";
import { exclusionReason } from "./exclusions.js";
import { sizeFromName, soldPerKg } from "./size.js";

// Menos de 1,5 g o 1,5 ml no es un tamaño creíble: preferimos no mostrar nada.
const MIN_AMOUNT = 0.0015;
const MATCH = 0.15;

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

// Electro, Textil, Hogar y Aire Libre: un tamaño en el nombre ("Motosierra 45 Cc",
// "Pileta 1500 L") no sirve para comparar precio por unidad.
const NON_CONSUMABLE = new Set(["catv00001990", "catv00001259", "catv00001260", "catv00001261"]);
function isConsumable(data) {
  return !(data?.groups ?? []).some((g) => NON_CONSUMABLE.has(g?.group_id));
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
const EMPTY = { group: "sin_dato", value: null, drained: false, take: 1, note: null, bankValue: null, bankName: null, bankBlocked: null };

// Por qué el banco no aplica: las promos bancarias no acumulan con ofertas, y hay
// productos excluidos de todas. null si aplica.
export function bankBlock(data) {
  if (isOnSale(data)) return "oferta";
  return exclusionReason(data);
}

// ¿amount es k veces single (k de 2 a 48, ±3%)?
function isPackMultiple(amount, single) {
  const k = Math.round(amount / single);
  return k >= 2 && k <= 48 && Math.abs(amount / single - k) / k <= 0.03;
}

// Grupo y precio por unidad (sin banco).
function measure(data, store) {
  const price = finalPrice(data, store);
  const base = pickStorePrice(data, store);
  if (!price || !base?.listPrice) return null;
  if (isWeighable(data)) return { group: "kg", value: price, drained: false, note: null };

  const name = data?.sku_display_name;
  const unit = normalizeUnit(data?.product_format, data?.product_format_quantity);
  if (unit.group === "sin_dato") {
    // Sin formato útil: "X Kg" o el tamaño del nombre.
    if (soldPerKg(name)) return { group: "kg", value: price, drained: false, note: null };
    if (!isConsumable(data)) return null;
    const size = sizeFromName(name);
    const amount = size && !size.multi ? size.amounts.at(-1) : null;
    return amount >= MIN_AMOUNT ? { group: size.kind, value: price / amount, drained: false, note: null } : null;
  }
  const paper = unit.group === "m2" || unit.group === "m" ? paperMetric(data?.sku_display_name) : null;
  if (paper?.divisor) return { group: paper.group, value: price / paper.divisor, drained: false, note: paper.note };
  if (!base.formatPrice) return null;
  // Papel higiénico sin metros en el nombre: el m² de Coto con un rollo de 10 cm de ancho
  // da los metros (1 m² = 10 m de rollo), así se compara con los demás por 10 m.
  if (paper?.kind === "toilet" && unit.group === "m2") {
    const m2 = base.listPrice / (base.formatPrice * unit.factor);
    // 0,5 a 300 m² (5 m a 3 km de papel): fuera de eso el dato de Coto no es creíble.
    if (m2 >= 0.5 && m2 <= 300) {
      const note = [paper.note, "≈ ancho 10 cm"].filter(Boolean).join(" · ");
      return { group: "rollo10m", value: price / m2, drained: false, note };
    }
  }
  // Coto a veces manda un formatPrice que no cierra con el tamaño del nombre
  // (ej. vodka 700 ml a $34 millones el litro). En ese caso manda el nombre.
  let amount = base.listPrice / (base.formatPrice * unit.factor);
  // No se corrige si: el nombre es ambiguo, su tamaño no es creíble, es "X KG", "Aprox."
  // o un peso entre paréntesis (precio por kilo), o Coto da un múltiplo exacto del tamaño
  // del nombre (es un pack que el nombre no explica). En escurridos el nombre da peso neto
  // y Coto el escurrido: solo se usa el nombre si el dato de Coto es absurdo, y entonces
  // la etiqueta deja de decir "escurrido".
  let drained = unit.drained;
  if (unit.group === "kg" || unit.group === "L") {
    const size = sizeFromName(name);
    const fromName = size?.amounts.at(-1);
    const usable =
      size?.kind === unit.group && !size.multi && !soldPerKg(name) &&
      !/aprox|\(\s*[\d.,]+\s*(kgs?|grs?|grm|g)\s*\)/i.test(name ?? "") && fromName >= MIN_AMOUNT;
    if (unit.drained) {
      if (!(amount >= MIN_AMOUNT) && usable) {
        amount = fromName;
        drained = false;
      }
    } else {
      const matches = usable && size.amounts.some((a) => Math.abs(amount - a) / a <= MATCH);
      if (usable && !matches && !isPackMultiple(amount, size.amounts[0])) amount = fromName;
    }
    if (!(amount >= MIN_AMOUNT)) return null;
  }
  return {
    group: unit.group,
    value: price / amount,
    drained,
    note: paper?.note ?? null,
  };
}

export function unitPrice(data, store, promos = [], day = 0) {
  const m = measure(data, store);
  if (!m) return { ...EMPTY };
  const value = round2(m.value);
  const promo = bestPromo(promos, day, false);
  const blocked = promo ? bankBlock(data) : null;
  const applies = promo && !blocked;
  return {
    group: m.group,
    value,
    drained: m.drained,
    note: m.note,
    take: takeQty(data, store),
    bankValue: applies ? round2(value * (1 - promo.percent / 100)) : null,
    bankName: applies ? promo.bank : null,
    bankBlocked: blocked,
  };
}
