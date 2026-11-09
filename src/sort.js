import { unitPrice } from "./unit-price.js";

// Ordena por precio final por unidad, agrupando kg / L / unidad / sin_dato.
// Devuelve { results, labels } con labels indexado por data.url.
export function sortByUnitPrice(results, store) {
  const groups = { kg: [], L: [], unidad: [], sin_dato: [] };
  for (const r of results) {
    const u = unitPrice(r?.data, store);
    groups[u.group].push({ r, u });
  }
  for (const g of ["kg", "L", "unidad"]) groups[g].sort((a, b) => a.u.value - b.u.value);

  const order = groups.L.length > groups.kg.length ? ["L", "kg"] : ["kg", "L"];
  order.push("unidad");

  const sorted = [];
  const labels = {};
  for (const g of order) {
    groups[g].forEach(({ r, u }, i) => {
      sorted.push(r);
      labels[r.data.url] = { group: u.group, value: u.value, drained: u.drained, groupStart: i === 0 };
    });
  }
  for (const { r } of groups.sin_dato) sorted.push(r);

  return { results: sorted, labels };
}
