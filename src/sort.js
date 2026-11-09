import { unitPrice } from "./unit-price.js";

const TIE_ORDER = ["kg", "L", "unidad", "rollo10m", "panos100", "m2", "m"];

// Ordena por precio final por unidad (con banco si hay promo), agrupando kg / L / unidad / sin_dato.
// Devuelve { results, labels, marks }: labels y marks indexados por data.url;
// marks tiene solo el primer producto de cada grupo.
export function sortByUnitPrice(results, store, promos = [], day = 0) {
  const groups = new Map();
  const unknown = [];
  for (const r of results) {
    const u = unitPrice(r?.data, store, promos, day);
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
  for (const g of order) {
    groups.get(g).forEach(({ r, u }, i) => {
      sorted.push(r);
      labels[r.data.url] = u;
      if (i === 0) marks[r.data.url] = g;
    });
  }
  sorted.push(...unknown);
  return { results: sorted, labels, marks };
}

// Etiquetas sin reordenar (carruseles, página de producto).
export function labelsFor(results, store, promos = [], day = 0) {
  const labels = {};
  for (const r of results ?? []) {
    const url = r?.data?.url;
    if (!url) continue;
    const u = unitPrice(r.data, store, promos, day);
    if (u.group !== "sin_dato") labels[url] = u;
  }
  return labels;
}
