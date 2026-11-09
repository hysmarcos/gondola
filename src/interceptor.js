// Intermediario entre Angular y la API de Coto.
// Parchea XMLHttpRequest para agregar el orden "precio por unidad" sin tocar el DOM,
// y lee (sin modificar) carruseles y carrito para publicar etiquetas y análisis.
import { sortByUnitPrice, labelsFor } from "./sort.js";
import { parsePromos } from "./banks.js";
import { analyzeCart } from "./cart.js";
import {
  isProductsUrl, isRecommendationsUrl, isCartUrl, isUnitSort, toNativeSort, cacheKey, pageUrl,
  requestedPage, storeOf, withSortOption, withResults, searchUrl, pluOf,
} from "./response.js";

const BATCH = 200;
const CAP = 1000;
const TTL = 5 * 60 * 1000;
const SOURCE = "coto-unit";
const NOTICE_FAIL = "No se pudo ordenar por precio por kg";
const NOTICE_CAP = "Se ordenaron los primeros 1.000 productos";
const HELD = ["load", "readystatechange"];
const PROMOS_URL = "https://www.coto.com.ar/rest/model/atg/actors/cProfileActor/getPromocionesMulticanal?enviroment=ag&pushSite=CotoDigital";

export function installInterceptor(win, deps) {
  const XHR = win.XMLHttpRequest;
  const proto = XHR.prototype;
  const origOpen = proto.open;
  const origAdd = proto.addEventListener;
  const cache = new Map();
  const pluCache = new Map();
  let lastSeq = 0;
  let lastProductsUrl = null;
  let lastCart = null;
  let lastCartBody = null;
  let lastList = null; // última lista vista: { results, store } para volver a etiquetar si cambia el banco
  const onCartPage = () => String(win.location?.pathname ?? "").startsWith("/carrito");

  // Configuración de banco: llega desde la extensión. Esperamos un rato antes de la primera respuesta.
  let settings = { selected: [], day: new Date().getDay() };
  let settingsReady;
  const ready = new Promise((resolve) => { settingsReady = resolve; });
  (deps.setTimeout ?? setTimeout)(settingsReady, deps.settingsWaitMs ?? 500);

  // seq ordena los mensajes: la etiqueta descarta los de pedidos más viejos.
  const post = (msg) => {
    try { deps.post({ source: SOURCE, ...msg }); } catch { /* sin etiquetas, pero Coto sigue */ }
  };

  const store = () => storeOf(lastProductsUrl ?? searchUrl("x"));
  const sig = () => settings.selected.map((p) => p.id).join(",") + "@" + settings.day;

  async function fetchJson(u) {
    const res = await deps.fetch(u);
    if (!res.ok) throw new Error("HTTP " + res.status);
    return res.json();
  }

  async function fetchSorted(url, total) {
    const count = Math.min(total, CAP);
    const pages = Math.max(1, Math.ceil(count / BATCH));
    const bodies = await Promise.all(
      Array.from({ length: pages }, async (_, i) => {
        const json = await fetchJson(pageUrl(url, i + 1, BATCH));
        if (!Array.isArray(json?.response?.results)) throw new Error("respuesta inesperada");
        return json.response.results;
      }),
    );
    const sorted = sortByUnitPrice(bodies.flat().slice(0, CAP), storeOf(url), settings.selected, settings.day);
    return { ...sorted, capped: total > CAP };
  }

  function getSorted(url, total) {
    const key = cacheKey(url) + "#" + sig();
    const hit = cache.get(key);
    if (hit && deps.now() - hit.at < TTL) return hit.promise;
    const promise = fetchSorted(url, total);
    cache.set(key, { at: deps.now(), promise });
    promise.catch(() => cache.delete(key));
    return promise;
  }

  function pageLabels(body, url) {
    return labelsFor(body.response.results, storeOf(url), settings.selected, settings.day);
  }

  async function transform({ url, unit, seq }, body) {
    await ready;
    if (!unit) {
      lastList = { results: body.response.results, store: storeOf(url) };
      post({ type: "labels", labels: pageLabels(body, url), marks: null, seq });
      return withSortOption(body, false);
    }
    try {
      const sorted = await getSorted(url, body.response.total_num_results ?? body.response.results.length);
      const { page, size } = requestedPage(url);
      const slice = sorted.results.slice((page - 1) * size, page * size);
      lastList = { results: sorted.results, store: storeOf(url) };
      post({ type: "labels", labels: sorted.labels, marks: sorted.marks, seq });
      if (sorted.capped) post({ type: "notice", text: NOTICE_CAP, seq });
      return withSortOption(withResults(body, slice), true);
    } catch {
      post({ type: "labels", labels: pageLabels(body, url), marks: null, seq });
      post({ type: "notice", text: NOTICE_FAIL, seq });
      return withSortOption(body, true);
    }
  }

  // Busca un producto por PLU (caché 5 min). Devuelve su `data` o null.
  function lookupPlu(plu) {
    const hit = pluCache.get(plu);
    if (hit && deps.now() - hit.at < TTL) return hit.promise;
    const promise = fetchJson(searchUrl(plu, lastProductsUrl))
      .then((json) => {
        const id = "prod" + plu.padStart(8, "0");
        return (json?.response?.results ?? []).find((r) => r?.data?.id === id)?.data ?? null;
      })
      .catch(() => null);
    pluCache.set(plu, { at: deps.now(), promise });
    return promise;
  }

  function postCart() {
    if (!lastCart) return;
    const seq = ++lastSeq;
    const analysis = analyzeCart(lastCart, settings.selected, settings.day, store());
    post({ type: "cart", analysis, seq });
  }

  // Corre fn sobre cada item con como mucho `limit` a la vez.
  async function pool(items, limit, fn) {
    const out = new Array(items.length);
    let next = 0;
    const worker = async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]);
      }
    };
    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
    return out;
  }

  // El mini-carrito pide getCarrito en todas las páginas: solo analizamos en /carrito.
  async function onCart(body) {
    lastCartBody = body;
    if (!onCartPage()) return;
    const items = Object.values(body?.output?.productoItems ?? {});
    const lines = await pool(items, 4, async (it) => {
      const plu = pluOf(it?.producto?.id);
      return {
        id: it?.producto?.id,
        name: it?.producto?.nombre ?? "",
        qty: Number(it?.cantidad) || 0,
        list: Number(it?.precio?.precioLista) || 0,
        data: plu ? await lookupPlu(plu) : null,
      };
    });
    await ready;
    lastCart = lines;
    postCart();
  }

  async function onRecommendations(body) {
    if (!Array.isArray(body?.response?.results)) return;
    await ready;
    post({ type: "labels", labels: labelsFor(body.response.results, store(), settings.selected, settings.day) });
  }

  async function onLookup({ plu, key }) {
    const data = await lookupPlu(String(plu));
    await ready;
    if (!data) return;
    const labels = labelsFor([{ data: { ...data, url: key } }], store(), settings.selected, settings.day);
    if (labels[key]) post({ type: "labels", labels });
  }

  deps.listen?.((msg) => {
    if (msg?.source !== SOURCE) return;
    if (msg.type === "settings") {
      settings = { selected: Array.isArray(msg.selected) ? msg.selected : [], day: Number(msg.day) || 0 };
      settingsReady();
      postCart();
      if (lastList) {
        post({ type: "labels", labels: labelsFor(lastList.results, lastList.store, settings.selected, settings.day) });
      }
    } else if (msg.type === "cartRequest" && lastCartBody) {
      onCart(lastCartBody).catch(() => {});
    } else if (msg.type === "lookup" && msg.plu && msg.key) {
      onLookup(msg).catch(() => {});
    }
  });

  fetchJson(deps.promosUrl ?? PROMOS_URL)
    .then((json) => post({ type: "promos", promos: parsePromos(json?.result) }))
    .catch(() => { /* sin promos: no hay línea de banco */ });

  function readJson(xhr) {
    return xhr.responseType === "json" ? xhr.response : JSON.parse(xhr.responseText);
  }

  function readBody(xhr) {
    const raw = readJson(xhr);
    return Array.isArray(raw?.response?.results) ? raw : null;
  }

  function serve(xhr, body) {
    const text = JSON.stringify(body);
    const value = xhr.responseType === "json" ? body : text;
    Object.defineProperty(xhr, "response", { configurable: true, get: () => value });
    Object.defineProperty(xhr, "responseText", { configurable: true, get: () => text });
  }

  // Lectura pasiva: no retiene oyentes ni cambia la respuesta.
  function watch(xhr, handler) {
    origAdd.call(xhr, "load", () => {
      if (xhr.status < 200 || xhr.status >= 300) return;
      let body;
      try { body = readJson(xhr); } catch { return; }
      Promise.resolve().then(() => handler(body)).catch(() => {});
    });
  }

  proto.open = function (method, url, ...rest) {
    const product = isProductsUrl(url);
    const unit = product && isUnitSort(url);
    const realUrl = unit ? toNativeSort(url) : url;
    if (product) {
      lastProductsUrl = String(url);
      hold(this, String(url), unit);
    } else if (isRecommendationsUrl(url)) {
      watch(this, onRecommendations);
    } else if (isCartUrl(url)) {
      watch(this, onCart);
    }
    return origOpen.call(this, method, realUrl, ...rest);
  };

  proto.addEventListener = function (type, fn, ...rest) {
    const h = this.__cotoHeld;
    if (h && HELD.includes(type)) {
      h.listeners[type].push(fn);
      return undefined;
    }
    return origAdd.call(this, type, fn, ...rest);
  };

  // Guarda los listeners de "load" y "readystatechange" hasta tener la respuesta final.
  function hold(xhr, url, unit) {
    // zone: open() corre dentro de la zona de Angular; liberamos ahí para que redibuje.
    const h = {
      url, unit, seq: ++lastSeq, zone: win.Zone?.current ?? null,
      listeners: { load: [], readystatechange: [] }, on: {},
    };
    xhr.__cotoHeld = h;
    for (const t of HELD) {
      Object.defineProperty(xhr, "on" + t, {
        configurable: true,
        get: () => h.on[t] ?? null,
        set: (fn) => { h.on[t] = fn; },
      });
    }

    const replay = (type, ev) => {
      for (const fn of h.listeners[type]) fn.call(xhr, ev);
      h.on[type]?.call(xhr, ev);
    };
    // El "load" nativo ya pasó sin oyentes; lo repetimos con un evento equivalente.
    const release = (ev) => {
      const run = () => {
        replay("readystatechange", ev);
        replay("load", { type: "load", target: xhr, currentTarget: xhr });
      };
      if (h.zone?.run) h.zone.run(run);
      else run();
    };

    origAdd.call(xhr, "readystatechange", (ev) => {
      if (xhr.readyState !== 4) return replay("readystatechange", ev);
      if (xhr.status < 200 || xhr.status >= 300) return release(ev);

      let body;
      try { body = readBody(xhr); } catch { body = null; }
      if (!body) return release(ev);

      transform(h, body)
        .then((out) => serve(xhr, out))
        .catch(() => { /* queda la respuesta original */ })
        .finally(() => release(ev));
    });
  }
}
