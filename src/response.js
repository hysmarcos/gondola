// Funciones puras sobre URLs de la API de Coto y sus respuestas JSON.

export const UNIT_SORT_OPTION = Object.freeze({
  sort_by: "unit_price",
  sort_order: "ascending",
  display_name: "Precio por kg/L: menor a mayor",
  hidden: false,
});

const BASE = "https://www.coto.com.ar";
const DEFAULT_SIZE = 24;
const DEFAULT_STORE = "200";
const VOLATILE = ["page", "num_results_per_page", "i", "s"];

const parse = (url) => new URL(String(url), BASE);

export function isProductsUrl(url) {
  return /\/products\/(categories|search|offers)\//.test(String(url));
}

export function isRecommendationsUrl(url) {
  return /\/products\/recommendations\//.test(String(url));
}

export function isCartUrl(url) {
  // getCarritoOrdenado (página /carrito) tiene otra forma: no es el carrito que leemos.
  return /cCarritoActor\/getCarrito(?![A-Za-z])/.test(String(url));
}

const DEFAULT_TEMPLATE =
  "https://api.coto.com.ar/api/v1/ms-digital-sitio-bff-web/api/v1/products/search/x" +
  "?key=key_r6xzz4IAoTWcipni&pre_filter_expression=%7B%22name%22:%22store_availability%22,%22value%22:%22200%22%7D" +
  "&c=cio-fe-web-coto-4.6.0&us=200";

// URL de búsqueda por PLU, copiando los parámetros del último pedido de productos visto.
export function searchUrl(plu, template) {
  const u = parse(template || DEFAULT_TEMPLATE);
  u.pathname = u.pathname.replace(/\/products\/.*$/, `/products/search/${plu}`);
  for (const k of ["page", "sort_by", "sort_order", "item_id"]) u.searchParams.delete(k);
  u.searchParams.set("num_results_per_page", "24");
  return u.toString();
}

// "prod00299912" o "_/R-00299912-00299912-200" → "299912".
export function pluOf(text) {
  const m = String(text ?? "").match(/(?:prod|R-)(\d+)/);
  return m ? String(parseInt(m[1], 10)) : null;
}

export function isUnitSort(url) {
  return parse(url).searchParams.get("sort_by") === UNIT_SORT_OPTION.sort_by;
}

export function toNativeSort(url) {
  const u = parse(url);
  u.searchParams.set("sort_by", "price");
  u.searchParams.set("sort_order", "ascending");
  return u.toString();
}

export function cacheKey(url) {
  const u = parse(url);
  const params = [...u.searchParams].filter(([k]) => !VOLATILE.includes(k));
  params.sort(([a, av], [b, bv]) => (a + "=" + av).localeCompare(b + "=" + bv));
  return u.origin + u.pathname + "?" + new URLSearchParams(params).toString();
}

export function pageUrl(url, page, size) {
  const u = parse(toNativeSort(url));
  u.searchParams.set("page", String(page));
  u.searchParams.set("num_results_per_page", String(size));
  return u.toString();
}

export function requestedPage(url) {
  const p = parse(url).searchParams;
  const page = parseInt(p.get("page"), 10);
  const size = parseInt(p.get("num_results_per_page"), 10);
  return { page: page > 0 ? page : 1, size: size > 0 ? size : DEFAULT_SIZE };
}

export function storeOf(url) {
  return parse(url).searchParams.get("us") || DEFAULT_STORE;
}

export function withSortOption(json, selected) {
  const out = structuredClone(json);
  const opts = out.response.sort_options ?? (out.response.sort_options = []);
  let mine = opts.find((o) => o.sort_by === UNIT_SORT_OPTION.sort_by);
  if (!mine) {
    mine = { ...UNIT_SORT_OPTION, status: "" };
    opts.push(mine);
  }
  if (selected) {
    for (const o of opts) o.status = "";
    mine.status = "selected";
  }
  return out;
}

export function withResults(json, results) {
  const out = structuredClone({ ...json, response: { ...json.response, results: [] } });
  out.response.results = results;
  return out;
}
