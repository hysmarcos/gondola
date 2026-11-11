// Información nutricional de toda la compra: suma de kcal, azúcares y sodio del carrito.

const int = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });
const one = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 });

// lines: líneas del análisis del carrito ({ ean, nutri, qty, amount }). results: Map ean →
// Nutrition | "missing" | "error". Cuenta solo comida con tamaño de envase y tabla.
// { kcal, sugars, sodiumMg, counted, total } o null si ningún producto tiene datos.
export function cartNutrition(lines, results) {
  const food = (lines ?? []).filter((l) => l.nutri && l.ean);
  const sum = { kcal: 0, sugars: 0, sodiumMg: 0, counted: 0, total: food.length };
  for (const l of food) {
    const n = results.get(String(l.ean));
    if (!n?.per100 || !(l.amount > 0) || !(l.qty > 0)) continue;
    // Envase en kg o L × 10 = cuántas veces 100 g o 100 ml.
    const times = l.amount * 10 * l.qty;
    for (const k of ["kcal", "sugars", "sodiumMg"]) if (n.per100[k] !== undefined) sum[k] += n.per100[k] * times;
    sum.counted++;
  }
  if (!sum.counted) return null;
  for (const k of ["kcal", "sugars", "sodiumMg"]) sum[k] = Math.round(sum[k] * 10) / 10;
  return sum;
}

// Filas para el resumen del carrito.
export function cartNutritionRows(sum) {
  if (!sum) return [];
  const rows = [{
    kind: "nutri",
    text: `Tu compra: ${int.format(sum.kcal)} kcal · ${int.format(sum.sugars)} g de azúcares · ${one.format(sum.sodiumMg / 1000)} g de sodio`,
  }];
  const missing = sum.total - sum.counted;
  if (missing > 0) rows.push({ kind: "nutri-note", text: `${missing} de ${sum.total} productos sin datos nutricionales` });
  return rows;
}
