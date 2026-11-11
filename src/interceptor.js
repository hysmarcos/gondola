// Intermediario entre Angular y la API de Coto.
// Parchea XMLHttpRequest para agregar el orden "precio por unidad" sin tocar el DOM,
// y lee (sin modificar) carruseles y carrito para publicar etiquetas y análisis.
import { sortByUnitPrice, labelsFor, lookupLabels } from "./sort.js";
import { parsePromos } from "./banks.js";
import { analyzeCart } from "./cart.js";
import { parseNxM, adjustQty, promoNotice } from "./promo.js";
import {
  isProductsUrl, isRecommendationsUrl, isCartUrl, isUnitSort, toNativeSort, cacheKey, pageUrl,
  requestedPage, storeOf, withSortOption, withResults, searchUrl, pluOf,
} from "./response.js";

const BATCH = 200;
const CAP = 1000;
const TTL = 5 * 60 * 1000;
const CACHE_MAX = 6; // listas completas guardadas
const PRODUCTS_MAX = 5000; // productos indexados para las promos 2x1
const SOURCE = "coto-unit";
const NOTICE_FAIL = "No se pudo ordenar por precio por kg";
const NOTICE_CAP = "Se ordenaron los primeros 1.000 productos";
const HELD = ["load", "readystatechange"];
const LOOKUP_WAIT_MS = 1500;
const ADD_RE = /cCarritoActor\/addOrRemoveItemToOrderV2/;
const PROMOS_URL = "https://www.coto.com.ar/rest/model/atg/actors/cProfileActor/getPromocionesMulticanal?enviroment=ag&pushSite=CotoDigital";

export function installInterceptor(win, deps) {
  const XHR = win.XMLHttpRequest;
  const proto = XHR.prototype;
  const origOpen = proto.open;
  const origAdd = proto.addEventListener;
  const origSend = proto.send;
  const cache = new Map();
  const pluCache = new Map();
  let lastSeq = 0;
  let lastProductsUrl = null;
  let lastCart = null;
  let lastCartBody = null;
  // Una vez que se abrió el mini-carrito, se entró a /carrito o se agregó algo, cada
  // respuesta del carrito se analiza (las búsquedas por PLU tienen caché).
  let cartWanted = false;
  const byProd = new Map(); // prodId → data, de todo producto visto
  const sentQty = new Map(); // prodId → última cantidad que mandamos (hasta que el carrito la confirme)
  const rejected = new Set(); // productos donde Coto rechazó una cantidad ajustada
  const pending = new Map(); // prodId → promesa del pedido que espera datos
  let lastList = null; // última lista vista: { results, store } para volver a etiquetar si cambia el banco
  const onCartPage = () => String(win.location?.pathname ?? "").startsWith("/carrito");

  // Configuración de banco: llega desde la extensión. Esperamos un rato antes de la primera respuesta.
  let settings = { selected: [], day: new Date().getDay(), autoPromo: true, notifyPromo: true, comunidad: true, markBest: true };
  let settingsReady;
  const ready = new Promise((resolve) => { settingsReady = resolve; });
  (deps.setTimeout ?? setTimeout)(settingsReady, deps.settingsWaitMs ?? 500);

  // seq ordena los mensajes: la etiqueta descarta los de pedidos más viejos.
  const post = (msg) => {
    try { deps.post({ source: SOURCE, ...msg }); } catch { /* sin etiquetas, pero Coto sigue */ }
  };

  const store = () => storeOf(lastProductsUrl ?? searchUrl("x"));
  const sig = () => settings.selected.map((p) => p.id).join(",") + "@" + settings.day + (settings.comunidad ? "" : "#sin-comunidad");
  const opts = () => ({ comunidad: settings.comunidad });

  async function fetchJson(u) {
    const res = await deps.fetch(u);
    if (!res.ok) throw new Error("HTTP " + res.status);
    return res.json();
  }

  function index(results) {
    for (const r of results ?? []) {
      if (!r?.data?.id) continue;
      byProd.delete(r.data.id);
      byProd.set(r.data.id, r.data);
    }
    while (byProd.size > PRODUCTS_MAX) byProd.delete(byProd.keys().next().value);
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
    index(bodies.flat());
    const sorted = sortByUnitPrice(bodies.flat().slice(0, CAP), storeOf(url), settings.selected, settings.day, opts());
    return { ...sorted, capped: total > CAP };
  }

  function getSorted(url, total) {
    // Mismo listado con cualquier orden: la caché se comparte entre orden nativo y por unidad.
    const key = cacheKey(toNativeSort(url)) + "#" + sig();
    const hit = cache.get(key);
    if (hit && deps.now() - hit.at < TTL) return hit.promise;
    const promise = fetchSorted(url, total);
    // Pocas listas en memoria: se van las vencidas y, si sobran, las más viejas.
    for (const [k, v] of cache) if (deps.now() - v.at >= TTL) cache.delete(k);
    cache.delete(key);
    cache.set(key, { at: deps.now(), promise });
    while (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value);
    promise.catch(() => cache.delete(key));
    return promise;
  }

  function pageLabels(body, url) {
    return labelsFor(body.response.results, storeOf(url), settings.selected, settings.day, opts());
  }

  // "Más barato de la categoría": sale de la categoría entera, no de la página visible.
  let lastBest = null; // { url, total } del último listado, para recalcular si cambia el banco
  // Búsquedas y ofertas mezclan de todo: ahí el cartel dice "de esta lista".
  const scopeOf = (url) => (/\/products\/categories\//.test(String(url)) ? "categoria" : "lista");
  // El número se toma al publicar: un resultado viejo no puede pisar uno nuevo.
  const sendBest = (url, best) => post({ type: "best", best, scope: scopeOf(url), seq: ++lastSeq });
  // Sin la categoría entera (más de 1.000 productos) no podemos decir cuál es el más barato.
  const bestOf = (sorted) => (sorted.capped ? {} : sorted.best);
  function postBest(url, total) {
    lastBest = { url, total };
    if (!settings.markBest || total < 3) return;
    getSorted(url, total)
      .then((sorted) => { if (lastBest?.url === url) sendBest(url, bestOf(sorted)); })
      .catch(() => { /* sin cartel, el resto sigue */ });
  }

  async function transform({ url, unit, seq }, body) {
    index(body.response.results);
    await ready;
    const total = body.response.total_num_results ?? body.response.results.length;
    // Lista nueva: el cartel de la anterior ya no vale.
    lastBest = { url, total };
    sendBest(url, {});
    if (!unit) {
      lastList = { results: body.response.results, store: storeOf(url) };
      post({ type: "labels", labels: pageLabels(body, url), marks: null, seq });
      postBest(url, total);
      return withSortOption(body, false);
    }
    try {
      const sorted = await getSorted(url, total);
      const { page, size } = requestedPage(url);
      const slice = sorted.results.slice((page - 1) * size, page * size);
      lastList = { results: sorted.results, store: storeOf(url) };
      post({ type: "labels", labels: sorted.labels, marks: sorted.marks, seq });
      if (settings.markBest) sendBest(url, bestOf(sorted));
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
        const data = (json?.response?.results ?? []).find((r) => r?.data?.id === id)?.data ?? null;
        if (data) byProd.set(id, data);
        return data;
      })
      .catch(() => null);
    pluCache.set(plu, { at: deps.now(), promise });
    return promise;
  }

  function postCart() {
    if (!lastCart) return;
    const seq = ++lastSeq;
    const analysis = analyzeCart(lastCart, settings.selected, settings.day, store(), opts());
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
  // force: lo pidió la extensión (página /carrito o mini-carrito abierto).
  async function onCart(body, force = false) {
    lastCartBody = body;
    // Solo olvidamos lo que el carrito ya confirma: un carrito pedido antes del último
    // agregado no debe pisar la cantidad que mandamos.
    for (const [id, q] of sentQty) if (cartQty(id) === q) sentQty.delete(id);
    if (!force && !onCartPage() && !cartWanted) return;
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
    index(body.response.results);
    await ready;
    post({ type: "labels", labels: labelsFor(body.response.results, store(), settings.selected, settings.day, opts()) });
  }

  async function onLookup({ plu, key }) {
    const data = await lookupPlu(String(plu));
    await ready;
    if (!data) return;
    const labels = lookupLabels(data, key, store(), settings.selected, settings.day, opts());
    if (labels[key]) post({ type: "labels", labels });
  }

  deps.listen?.((msg) => {
    if (msg?.source !== SOURCE) return;
    if (msg.type === "settings") {
      settings = {
        selected: Array.isArray(msg.selected) ? msg.selected : [],
        day: Number(msg.day) || 0,
        autoPromo: msg.autoPromo !== false,
        notifyPromo: msg.notifyPromo !== false,
        comunidad: msg.comunidad !== false,
        markBest: msg.markBest !== false,
      };
      settingsReady();
      postCart();
      if (lastBest) postBest(lastBest.url, lastBest.total);
      if (lastList) {
        post({ type: "labels", labels: labelsFor(lastList.results, lastList.store, settings.selected, settings.day, opts()) });
      }
    } else if (msg.type === "cartRequest") {
      // Se abrió el mini-carrito o /carrito: desde ahora cada carrito nuevo se analiza.
      cartWanted = true;
      if (lastCartBody) onCart(lastCartBody, true).catch(() => {});
    } else if (msg.type === "lookup" && msg.plu && msg.key) {
      onLookup(msg).catch(() => {});
    }
  });

  fetchJson(deps.promosUrl ?? PROMOS_URL)
    .then((json) => post({ type: "promos", promos: parsePromos(json?.result) }))
    .catch(() => { /* sin promos: no hay línea de banco */ });

  // Cantidad que tiene hoy el carrito para ese producto.
  function cartQty(prodId) {
    const items = Object.values(lastCartBody?.output?.productoItems ?? {});
    return Number(items.find((it) => it?.producto?.id === prodId)?.cantidad) || 0;
  }

  // Dato del producto: del índice, o buscado por PLU con un tope de espera.
  function productData(prodId) {
    if (byProd.has(prodId)) return byProd.get(prodId);
    const plu = pluOf(prodId);
    if (!plu) return null;
    const wait = new Promise((r) => (deps.setTimeout ?? setTimeout)(() => r(null), deps.lookupWaitMs ?? LOOKUP_WAIT_MS));
    return Promise.race([lookupPlu(plu), wait]);
  }

  // Agregar al carrito: completa promos NxM antes de mandar. Devuelve el body a enviar.
  function adjustAdd(payload, data) {
    const { prodId } = payload;
    const want = Number(payload.quantity);
    const prev = sentQty.get(prodId) ?? cartQty(prodId);
    // Si Coto ya rechazó una cantidad ajustada de este producto, no insistimos.
    const nxm = rejected.has(prodId) ? null : parseNxM(data);
    const next = settings.autoPromo ? adjustQty(prev, want, nxm) : want;
    sentQty.set(prodId, next);
    if (next !== want) {
      try { deps.pin?.(prodId, want, next); } catch { /* el carrito igual queda bien */ }
      post({ type: "promoAdjust", prodId, skuId: payload.skuId, from: want, quantity: next });
    }
    if (settings.notifyPromo && next > prev) {
      const text = promoNotice(data, next, next - want);
      if (text) post({ type: "promoNotice", prodId, text });
    }
    return next === want ? null : JSON.stringify({ ...payload, quantity: next });
  }

  // Si Coto rechaza el pedido, la cantidad que mandamos no vale; y si la habíamos ajustado,
  // el próximo intento va como lo pidió el usuario.
  function watchAdd(xhr, prodId, adjusted) {
    origAdd.call(xhr, "load", () => {
      let ok = xhr.status >= 200 && xhr.status < 300;
      try { ok = ok && String(readJson(xhr)?.codigoError ?? "0") === "0"; } catch { /* respuesta rara: la damos por buena */ }
      if (ok) return;
      sentQty.delete(prodId);
      if (adjusted()) rejected.add(prodId);
    });
  }

  // Decide y manda un pedido. Devuelve una promesa si tuvo que esperar datos del producto.
  function runAdd(xhr, body, payload) {
    const { prodId } = payload;
    let adjusted = false;
    watchAdd(xhr, prodId, () => adjusted);
    const quantity = Number(payload.quantity);
    const prev = sentQty.get(prodId) ?? cartQty(prodId);
    // Bajar o borrar: no hace falta saber la promo.
    if (quantity <= prev || (!settings.autoPromo && !settings.notifyPromo)) {
      sentQty.set(prodId, quantity);
      return origSend.call(xhr, body);
    }
    const data = productData(prodId);
    const finish = (out) => {
      adjusted = !!out;
      return origSend.call(xhr, out ?? body);
    };
    if (!(data instanceof Promise)) return finish(data ? adjustAdd(payload, data) : null);
    // Angular puede cancelar el pedido mientras buscamos el producto: entonces no sale.
    let aborted = false;
    const abort = xhr.abort;
    xhr.abort = function (...args) { aborted = true; return abort.apply(this, args); };
    return data
      .then((d) => (d ? adjustAdd(payload, d) : null))
      .catch(() => null)
      .then((out) => { if (!aborted) finish(out); });
  }

  function sendAdd(xhr, body) {
    cartWanted = true;
    let payload;
    try { payload = JSON.parse(body); } catch { payload = null; }
    if (!payload?.prodId || !Number.isFinite(Number(payload.quantity))) return origSend.call(xhr, body);
    const { prodId } = payload;
    try { deps.unpin?.(prodId); } catch { /* sin fijación */ }
    // Los pedidos de un mismo producto salen en orden: si uno espera datos, los demás también.
    const waiting = pending.get(prodId);
    const result = waiting ? waiting.then(() => runAdd(xhr, body, payload)) : runAdd(xhr, body, payload);
    if (result instanceof Promise) {
      const tail = result.catch(() => {});
      pending.set(prodId, tail);
      tail.then(() => { if (pending.get(prodId) === tail) pending.delete(prodId); });
      return undefined;
    }
    return result;
  }

  proto.send = function (body) {
    if (this.__cotoAdd) {
      try { return sendAdd(this, body); } catch { return origSend.call(this, body); }
    }
    return origSend.call(this, body);
  };

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
    // Se reasigna en cada open: un XHR reusado para otra cosa no queda marcado.
    this.__cotoAdd = ADD_RE.test(String(url)) && String(method).toUpperCase() === "POST";
    return origOpen.call(this, method, realUrl, ...rest);
  };

  // Guarda los listeners de "load" y "readystatechange" hasta tener la respuesta final.
  function hold(xhr, url, unit) {
    // zone: open() corre dentro de la zona de Angular; liberamos ahí para que redibuje.
    const h = {
      url, unit, seq: ++lastSeq, zone: win.Zone?.current ?? null,
      listeners: { load: [], readystatechange: [] }, on: {},
    };
    xhr.__cotoHeld = h;
    // Solo en este XHR: tapar addEventListener en el prototipo saca a todos los demás
    // pedidos de la zona de Angular (zone.js lo parchea después) y la caja no se dibuja.
    Object.defineProperty(xhr, "addEventListener", {
      configurable: true,
      writable: true,
      value(type, fn, ...rest) {
        if (HELD.includes(type)) {
          h.listeners[type].push(fn);
          return undefined;
        }
        return proto.addEventListener.call(this, type, fn, ...rest);
      },
    });
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

  // Para promo-clicks.js (mismo mundo): datos del producto y ajustes, sin red.
  return {
    dataFor: (prodId) => byProd.get(prodId) ?? null,
    // promo-clicks llevó el contador a q: un "−" desde ahí es una baja, no una suba.
    expect: (prodId, q) => sentQty.set(prodId, q),
    autoPromo: () => settings.autoPromo,
    notify: (prodId, text) => { if (settings.notifyPromo) post({ type: "promoNotice", prodId, text }); },
  };
}
