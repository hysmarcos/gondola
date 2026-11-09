// Auditoría de la lógica de precio por unidad sobre el catálogo real de Coto.
// Herramienta de desarrollo: no va en la extensión.
import { unitPrice, normalizeUnit, pickStorePrice } from "./unit-price.js";

const FOOD_TOPS = new Set(["Almacén", "Frescos", "Bebidas", "Congelados", "Limpieza", "Perfumería"]);
const UNITS = [
  [/^(kg|kgs|kilo|kilos)$/, "kg", 1],
  [/^(g|gr|grs|grm|gramos)$/, "kg", 0.001],
  [/^(l|lt|lts|ltr|litro|litros)$/, "L", 1],
  [/^(ml|cc|cm3)$/, "L", 0.001],
];
const SIZE = "(\\d+(?:[.,]\\d+)?)\\s*(kgs?|kilos?|grs?|grm|gramos|g|lts?|ltr|litros?|l|ml|cc|cm3)\\b";

function toAmount(n, unit) {
  const u = unit.toLowerCase();
  for (const [re, kind, mult] of UNITS) if (re.test(u)) return { kind, amount: Number(n.replace(",", ".")) * mult };
  return null;
}

// Tamaño que dice el nombre: { kind: "kg" | "L", amounts: [unidad, pack?] } o null.
export function sizeFromName(name) {
  const text = String(name ?? "");
  const pack = text.match(new RegExp(`(\\d+)\\s*x\\s*${SIZE}`, "i")) ?? null;
  if (pack) {
    const one = toAmount(pack[2], pack[3]);
    if (one) return { kind: one.kind, amounts: [round(one.amount), round(one.amount * Number(pack[1]))] };
  }
  const all = [...text.matchAll(new RegExp(SIZE, "gi"))];
  const last = all.at(-1);
  if (!last) return null;
  const one = toAmount(last[1], last[2]);
  return one ? { kind: one.kind, amounts: [round(one.amount)] } : null;
}

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

    // ¿El tamaño implícito en formatPrice coincide con el del nombre?
    const unit = normalizeUnit(data?.product_format, data?.product_format_quantity);
    const base = pickStorePrice(data, store);
    const size = sizeFromName(name);
    if ((unit.group === "kg" || unit.group === "L") && size?.kind === unit.group && base?.formatPrice && base?.listPrice) {
      const implied = base.listPrice / (base.formatPrice * unit.factor);
      const ok = size.amounts.some((a) => Math.abs(implied - a) / a <= 0.15);
      if (!ok) sizeMismatch.push({ name, cat, implied: round(implied), fromName: size.amounts });
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
