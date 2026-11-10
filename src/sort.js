import { unitPrice } from "./unit-price.js";
import { compareFields } from "./compare.js";
import { nutriEligible } from "./nutrition.js";

const MIN_FOR_BEST = 3;
const TIE_ORDER = ["kg", "L", "unidad", "rollo10m", "panos100", "m2", "m"];

// Ordena por precio final por unidad (con banco si hay promo), agrupando kg / L / unidad / sin_dato.
// Devuelve { results, labels, marks }: labels y marks indexados por data.url;
// marks tiene solo el primer producto de cada grupo.
export function sortByUnitPrice(results, store, promos = [], day = 0, opts = {}) {
  const groups = new Map();
  const unknown = [];
  for (const r of results) {
    const u = unitPrice(r?.data, store, promos, day, opts);
    if (u.group === "sin_dato") {
      unknown.push(r);
      continue;
    }
    if (!groups.has(u.group)) groups.set(u.group, []);
    groups.get(u.group).push({ r, u, key: u.bankValue ?? u.value });
  }
  for (const list of groups.values()) list.sort((a, b) => a.key - b.key);

  // El grupo con más productos primero; empate según TIE_ORDER.
  const rank = (g) => (TIE_ORDER.includes(g) ? TIE_ORDER.indexOf(g) : TIE_ORDER.length);
  const order = [...groups.keys()].sort((a, b) => groups.get(b).length - groups.get(a).length || rank(a) - rank(b));

  const sorted = [];
  const labels = {};
  const marks = {};
  const best = {}; // el más barato de cada grupo con al menos MIN_FOR_BEST productos
  for (const g of order) {
    const list = groups.get(g);
    list.forEach(({ r, u }, i) => {
      sorted.push(r);
      const label = { ...u, ...compareFields(r.data, store, opts), nutri: nutriEligible(r.data) };
      labels[r.data.url] = label;
      // Igual que labelsFor: los carruseles buscan por id de producto.
      if (r.data.id) labels[r.data.id] = label;
      if (i === 0) marks[r.data.url] = g;
      if (i === 0 && list.length >= MIN_FOR_BEST) best[r.data.url] = g;
    });
  }
  sorted.push(...unknown);
  return { results: sorted, labels, marks, best };
}

// Etiquetas sin reordenar (carruseles, página de producto).
export function labelsFor(results, store, promos = [], day = 0, opts = {}) {
  const labels = {};
  for (const r of results ?? []) {
    const url = r?.data?.url;
    if (!url) continue;
    const u = unitPrice(r.data, store, promos, day, opts);
    if (u.group === "sin_dato") continue;
    const label = { ...u, ...compareFields(r.data, store, opts), nutri: nutriEligible(r.data) };
    labels[url] = label;
    // Los carruseles de recomendaciones no tienen link: se buscan por id de producto.
    if (r.data.id) labels[r.data.id] = label;
  }
  return labels;
}
