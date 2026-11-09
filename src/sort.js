import { unitPrice } from "./unit-price.js";

// Ordena por precio final por unidad (con banco si hay promo), agrupando kg / L / unidad / sin_dato.
// Devuelve { results, labels, marks }: labels y marks indexados por data.url;
// marks tiene solo el primer producto de cada grupo.
export function sortByUnitPrice(results, store, promos = [], day = 0) {
  const groups = { kg: [], L: [], unidad: [], sin_dato: [] };
  for (const r of results) {
    const u = unitPrice(r?.data, store, promos, day);
    groups[u.group].push({ r, u, key: u.bankValue ?? u.value });
  }
  for (const g of ["kg", "L", "unidad"]) groups[g].sort((a, b) => a.key - b.key);

  const order = groups.L.length > groups.kg.length ? ["L", "kg"] : ["kg", "L"];
  order.push("unidad");

  const sorted = [];
  const labels = {};
  const marks = {};
  for (const g of order) {
    groups[g].forEach(({ r, u }, i) => {
      sorted.push(r);
      labels[r.data.url] = u;
      if (i === 0) marks[r.data.url] = g;
    });
  }
  for (const { r } of groups.sin_dato) sorted.push(r);

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
