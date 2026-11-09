// Auditoría de la lógica de precio por unidad sobre el catálogo real de Coto.
// Herramienta de desarrollo: no va en la extensión.
import { unitPrice, finalPrice } from "./unit-price.js";
import { sizeFromName, soldPerKg } from "./size.js";

export { sizeFromName };

const FOOD_TOPS = new Set(["Almacén", "Frescos", "Bebidas", "Congelados", "Limpieza", "Perfumería"]);
const round = (n) => Math.round(n * 10000) / 10000;

function median(nums) {
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

// items: [{ data, top, cat }]. Devuelve los casos para revisar.
export function auditItems(items, store) {
  const noUnit = [];
  const sizeMismatch = [];
  const byKey = new Map();
  let labeled = 0;

  for (const { data, top, cat } of items) {
    const name = data?.sku_display_name ?? "";
    const label = unitPrice(data, store);
    if (label.group === "sin_dato") {
      if (FOOD_TOPS.has(top)) noUnit.push({ name, cat, format: data?.product_format ?? null });
      continue;
    }
    labeled++;
    const key = cat + "|" + label.group;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push({ name, cat, group: label.group, value: label.value });

    // ¿El precio por unidad que mostramos cierra con el tamaño del nombre?
    const size = sizeFromName(name);
    const price = finalPrice(data, store);
    // Mismas reglas que la etiqueta: nombres ambiguos, "X KG" o tamaños no creíbles no cuentan.
    const usable = size && !size.multi && !soldPerKg(name) && size.amounts.at(-1) >= 0.0015;
    if ((label.group === "kg" || label.group === "L") && usable && size.kind === label.group && price) {
      const implied = price / label.value;
      if (!size.amounts.some((a) => Math.abs(implied - a) / a <= 0.15)) {
        sizeMismatch.push({ name, cat, implied: round(implied), fromName: size.amounts });
      }
    }
  }

  const outliers = [];
  for (const list of byKey.values()) {
    if (list.length < 4) continue;
    const med = median(list.map((x) => x.value));
    for (const x of list) {
      if (x.value > med * 8 || x.value < med / 8) outliers.push({ ...x, median: med });
    }
  }
  return { counts: { total: items.length, labeled }, noUnit, outliers, sizeMismatch };
}

// Campos que usa la lógica; el resto se descarta para que el catálogo pese poco.
function trim(data, store) {
  return {
    url: data.url, id: data.id, sku_display_name: data.sku_display_name, product_brand: data.product_brand,
    product_format: data.product_format, product_format_quantity: data.product_format_quantity,
    product_weighable: data.product_weighable, product_unit_of_measure: data.product_unit_of_measure,
    price: (data.price ?? []).filter((p) => p.store === store).map(({ store: st, listPrice, formatPrice }) => ({ store: st, listPrice, formatPrice })),
    discounts: (data.discounts ?? []).map(({ discountText, takingText, discountPrice }) => ({ discountText, takingText, discountPrice })),
    discounts_payment_methods: (data.discounts_payment_methods ?? []).map(({ precioCuota, cantidadCuotas }) => ({ precioCuota, cantidadCuotas })),
    groups: (data.groups ?? []).map((g) => ({ group_id: g.group_id })),
  };
}

// Baja todas las categorías hoja (hasta maxPages páginas de 200). leaves: [[id, top, cat]].
export async function downloadCatalog({ fetchJson, leaves, store = "200", maxPages = 5, concurrency = 6 }) {
  const api = "https://api.coto.com.ar/api/v1/ms-digital-sitio-bff-web/api/v1/products/categories/";
  const q = `?key=key_r6xzz4IAoTWcipni&pre_filter_expression=%7B%22name%22:%22store_availability%22,%22value%22:%22${store}%22%7D&c=cio-fe-web-coto-4.6.0&us=${store}&num_results_per_page=200`;
  const items = [];
  let next = 0;
  const worker = async () => {
    while (next < leaves.length) {
      const [id, top, cat] = leaves[next++];
      for (let page = 1; page <= maxPages; page++) {
        let json;
        try { json = await fetchJson(`${api}${id}${q}&page=${page}`); } catch { break; }
        for (const r of json?.response?.results ?? []) items.push({ data: trim(r.data, store), top, cat });
        if (page * 200 >= (json?.response?.total_num_results ?? 0)) break;
      }
    }
  };
  await Promise.all(Array.from({ length: concurrency }, worker));
  return items;
}
