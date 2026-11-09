// Intermediario entre Angular y la API de Coto.
// Parchea XMLHttpRequest para agregar el orden "precio por unidad" sin tocar el DOM.
import { sortByUnitPrice } from "./sort.js";
import {
  isProductsUrl, isUnitSort, toNativeSort, cacheKey, pageUrl,
  requestedPage, storeOf, withSortOption, withResults,
} from "./response.js";

const BATCH = 200;
const CAP = 1000;
const TTL = 5 * 60 * 1000;
const SOURCE = "coto-unit";
const NOTICE_FAIL = "No se pudo ordenar por precio por kg";
const NOTICE_CAP = "Se ordenaron los primeros 1.000 productos";
const HELD = ["load", "readystatechange"];

export function installInterceptor(win, deps) {
  const XHR = win.XMLHttpRequest;
  const proto = XHR.prototype;
  const origOpen = proto.open;
  const origAdd = proto.addEventListener;
  const cache = new Map();
  let lastSeq = 0;

  // seq ordena los mensajes: la etiqueta descarta los de pedidos más viejos.
  const post = (seq, msg) => {
    try { deps.post({ source: SOURCE, seq, ...msg }); } catch { /* sin etiquetas, pero Coto sigue */ }
  };

  async function fetchSorted(url, total) {
    const count = Math.min(total, CAP);
    const pages = Math.max(1, Math.ceil(count / BATCH));
    const bodies = await Promise.all(
      Array.from({ length: pages }, async (_, i) => {
        const res = await deps.fetch(pageUrl(url, i + 1, BATCH));
        if (!res.ok) throw new Error("HTTP " + res.status);
        const json = await res.json();
        if (!Array.isArray(json?.response?.results)) throw new Error("respuesta inesperada");
        return json.response.results;
      }),
    );
    const sorted = sortByUnitPrice(bodies.flat().slice(0, CAP), storeOf(url));
    return { ...sorted, capped: total > CAP };
  }

  function getSorted(url, total) {
    const key = cacheKey(url);
    const hit = cache.get(key);
    if (hit && deps.now() - hit.at < TTL) return hit.promise;
    const promise = fetchSorted(url, total);
    cache.set(key, { at: deps.now(), promise });
    promise.catch(() => cache.delete(key));
    return promise;
  }

  async function transform({ url, unit, seq }, body) {
    if (!unit) {
      post(seq, { type: "labels", active: false });
      return withSortOption(body, false);
    }
    try {
      const sorted = await getSorted(url, body.response.total_num_results ?? body.response.results.length);
      const { page, size } = requestedPage(url);
      const slice = sorted.results.slice((page - 1) * size, page * size);
      post(seq, { type: "labels", active: true, labels: sorted.labels });
      if (sorted.capped) post(seq, { type: "notice", text: NOTICE_CAP });
      return withSortOption(withResults(body, slice), true);
    } catch {
      post(seq, { type: "labels", active: false });
      post(seq, { type: "notice", text: NOTICE_FAIL });
      return withSortOption(body, true);
    }
  }

  function readBody(xhr) {
    const raw = xhr.responseType === "json" ? xhr.response : JSON.parse(xhr.responseText);
    return Array.isArray(raw?.response?.results) ? raw : null;
  }

  function serve(xhr, body) {
    const text = JSON.stringify(body);
    const value = xhr.responseType === "json" ? body : text;
    Object.defineProperty(xhr, "response", { configurable: true, get: () => value });
    Object.defineProperty(xhr, "responseText", { configurable: true, get: () => text });
  }

  proto.open = function (method, url, ...rest) {
    const product = isProductsUrl(url);
    const unit = product && isUnitSort(url);
    const realUrl = unit ? toNativeSort(url) : url;
    if (product) hold(this, String(url), unit);
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
