import { describe, it, expect, beforeEach } from "vitest";
import { installInterceptor } from "../src/interceptor.js";
import { row, apiBody } from "./fixtures/coto.js";
import { PROMOS_RESULT } from "./fixtures/promos.js";
import { CARRITO_BODY, CART_ROWS, searchData } from "./fixtures/cart.js";

const API = "https://api.coto.com.ar/api/v1/ms-digital-sitio-bff-web/api/v1/products/";
const Q = "&us=200&i=abc&s=1";
const url = (sort, page = 1, size = 24) =>
  `${API}categories/catv1?sort_by=${sort}&sort_order=ascending&page=${page}&num_results_per_page=${size}${Q}`;

// N productos por kilo; p0 es el más caro, así el orden por unidad los invierte.
const catalog = (n) => Array.from({ length: n }, (_, i) => row([`p${i}`, `p${i}`, "Kilo", 1, 100, 1000 + n - i, null, null, null]));
const urls = (results) => results.map((r) => r.data.url);
const pageOf = (u) => Number(new URL(u).searchParams.get("page"));
const sizeOf = (u) => Number(new URL(u).searchParams.get("num_results_per_page"));

// Imita lo que usa Angular de un XHR real. Los on* viven en un "slot" interno,
// como en el navegador: si alguien los tapa en la instancia, el XHR no los ve.
function makeFakeXHR(server) {
  const seen = [];
  const sent = [];
  class FakeXHR {
    constructor() {
      this.readyState = 0;
      this.status = 0;
      this.responseType = "";
      this._l = {};
      this._slot = {};
    }
    open(method, u) { this._method = method; this._url = u; this.readyState = 1; }
    addEventListener(t, fn) { (this._l[t] ||= []).push(fn); }
    removeEventListener() {}
    abort() { this._aborted = true; }
    _fire(t) {
      const ev = { type: t, target: this };
      for (const fn of this._l[t] || []) fn.call(this, ev);
      this._slot[t]?.call(this, ev);
    }
    send(payload) {
      seen.push(this._url);
      sent.push({ url: this._url, method: this._method, payload });
      queueMicrotask(() => {
        const body = server(this._url, payload);
        this._text = typeof body === "string" ? body : JSON.stringify(body);
        this.status = 200;
        this.readyState = 4;
        this._fire("readystatechange");
        this._fire("load");
      });
    }
    get responseText() { return this._text; }
    get response() { return this.responseType === "json" ? JSON.parse(this._text) : this._text; }
  }
  for (const t of ["load", "readystatechange"]) {
    Object.defineProperty(FakeXHR.prototype, "on" + t, {
      configurable: true,
      get() { return this._slot[t] ?? null; },
      set(fn) { this._slot[t] = fn; },
    });
  }
  return { FakeXHR, seen, sent };
}

const PROMOS_URL = "https://www.coto.com.ar/promos-test";

function setup({ total = 250, fetchFails = false, serverBody, settingsWaitMs = 0, settings, lookupWaitMs } = {}) {
  const all = catalog(total);
  const server = serverBody ?? ((u) => {
    if (/getCarrito/.test(u)) return CARRITO_BODY;
    const { page, size } = { page: pageOf(u) || 1, size: sizeOf(u) || 24 };
    return apiBody(all.slice((page - 1) * size, page * size), total);
  });
  const { FakeXHR, seen, sent } = makeFakeXHR(server);
  const env = { time: 0, fetched: [], searched: [], posts: [], listeners: [], pins: [], unpins: [] };
  const deps = {
    now: () => env.time,
    post: (m) => env.posts.push(m),
    pin: (...a) => env.pins.push(a),
    unpin: (id) => env.unpins.push(id),
    listen: (fn) => env.listeners.push(fn),
    promosUrl: PROMOS_URL,
    settingsWaitMs,
    lookupWaitMs,
    fetch: async (u) => {
      if (u === PROMOS_URL) return { ok: true, json: async () => ({ result: PROMOS_RESULT }) };
      const plu = String(u).match(/\/search\/(\d+)\?/)?.[1];
      if (plu) {
        env.searched.push(plu);
        if (env.onSearch) await env.onSearch();
        const r = CART_ROWS.find((row) => String(parseInt(row[0].slice(4), 10)) === plu);
        return { ok: true, json: async () => apiBody(r ? [{ data: searchData(r) }] : []) };
      }
      env.fetched.push(u);
      if (fetchFails) throw new Error("red caída");
      const p = pageOf(u), s = sizeOf(u);
      return { ok: true, json: async () => apiBody(all.slice((p - 1) * s, p * s), total) };
    },
  };
  const win = { XMLHttpRequest: FakeXHR, location: { pathname: "/carrito" } };
  const api = installInterceptor(win, deps);
  const send = (msg) => env.listeners.forEach((fn) => fn({ source: "coto-unit", ...msg }));
  if (settings) send({ type: "settings", ...settings });
  return { win, env, seen, sent, all, send, api };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

function request(win, u, { type = "", useOnload = false } = {}) {
  return new Promise((resolve) => {
    const x = new win.XMLHttpRequest();
    x.open("GET", u);
    x.responseType = type;
    const done = () => resolve({ x, body: type === "json" ? x.response : JSON.parse(x.responseText) });
    if (useOnload) x.onload = done;
    else x.addEventListener("load", done);
    x.send();
  });
}

const mine = (body) => body.response.sort_options.find((o) => o.sort_by === "unit_price");

describe("installInterceptor", () => {
  let s;
  beforeEach(() => { s = setup(); });

  it("orden nativo: agrega la opción sin tocar los resultados", async () => {
    const { body } = await request(s.win, url("price"));
    expect(mine(body).status).toBe("");
    expect(urls(body.response.results)).toEqual(urls(s.all.slice(0, 24)));
    // v5: la categoría se baja en segundo plano para "Más barato de la categoría".
    expect(s.env.fetched.map(pageOf)).toEqual([1, 2]);
    const msg = s.env.posts.find((m) => m.type === "labels");
    expect(msg.marks).toBeNull();
    expect(Object.keys(msg.labels)).toHaveLength(24);
  });

  it("orden por unidad: pide todo, ordena y devuelve la página 1", async () => {
    const { body } = await request(s.win, url("unit_price"));
    expect(new URL(s.seen[0]).searchParams.get("sort_by")).toBe("price");
    expect(s.env.fetched.map(pageOf)).toEqual([1, 2]);
    expect(s.env.fetched.map(sizeOf)).toEqual([200, 200]);
    expect(urls(body.response.results)).toEqual(Array.from({ length: 24 }, (_, i) => `p${249 - i}`));
    expect(body.response.total_num_results).toBe(250);
    expect(mine(body).status).toBe("selected");
    const labels = s.env.posts.find((m) => m.type === "labels" && m.marks);
    expect(labels.marks).toEqual({ p249: "kg" });
    expect(Object.keys(labels.labels)).toHaveLength(250);
  });

  it("página 2 sale de la caché", async () => {
    await request(s.win, url("unit_price", 1));
    const { body } = await request(s.win, url("unit_price", 2));
    expect(s.env.fetched).toHaveLength(2);
    expect(urls(body.response.results)[0]).toBe("p225");
  });

  it("la caché vence a los 5 minutos", async () => {
    await request(s.win, url("unit_price", 1));
    s.env.time = 5 * 60 * 1000 + 1;
    await request(s.win, url("unit_price", 2));
    expect(s.env.fetched).toHaveLength(4);
  });

  it("entrar directo a la página 3 funciona", async () => {
    const { body } = await request(s.win, url("unit_price", 3));
    expect(urls(body.response.results)[0]).toBe("p201");
    expect(body.response.results).toHaveLength(24);
  });

  it("también llama a onload", async () => {
    const { body } = await request(s.win, url("unit_price"), { useOnload: true });
    expect(urls(body.response.results)[0]).toBe("p249");
  });

  it("funciona con responseType json", async () => {
    const { body } = await request(s.win, url("unit_price"), { type: "json" });
    expect(urls(body.response.results)[0]).toBe("p249");
  });
});

describe("Angular y zone.js", () => {
  it("libera los listeners dentro de la zona donde se abrió el pedido", async () => {
    const s = setup();
    const ngZone = { name: "angular", inside: false, run(fn) { this.inside = true; try { return fn(); } finally { this.inside = false; } } };
    s.win.Zone = { current: ngZone };
    let ranInside = null;
    await new Promise((resolve) => {
      const x = new s.win.XMLHttpRequest();
      x.open("GET", url("unit_price"));
      s.win.Zone.current = { name: "root", run: (fn) => fn() };
      x.addEventListener("load", () => { ranInside = ngZone.inside; resolve(); });
      x.send();
    });
    expect(ranInside).toBe(true);
  });

  // zone.js parchea EventTarget.prototype.addEventListener después de nosotros. Si tapamos
  // addEventListener en el prototipo del XHR, los pedidos ajenos (ej. la caja) salen de la
  // zona de Angular y la página no se redibuja.
  it("los pedidos que no son de productos usan el addEventListener que esté vigente", () => {
    class Target { addEventListener() { this.native = true; } }
    class XHR extends Target { open() {} send() {} }
    installInterceptor({ XMLHttpRequest: XHR, location: { pathname: "/caja/" } }, {
      now: () => 0, post: () => {}, fetch: async () => ({ ok: false }), settingsWaitMs: 0,
    });
    const zoned = [];
    Target.prototype.addEventListener = function (t) { zoned.push(t); };
    const x = new XHR();
    x.open("GET", "https://www.coto.com.ar/rest/model/atg/actors/cCarritoActor/getCarrito?grp=1");
    zoned.length = 0;
    x.addEventListener("load", () => {});
    expect(zoned).toEqual(["load"]);
  });

  it("cada pedido de productos lleva un número creciente", async () => {
    const s = setup();
    await request(s.win, url("price"));
    await request(s.win, url("unit_price"));
    const seqs = s.env.posts.filter((m) => m.type === "labels").map((m) => m.seq);
    expect(seqs.every((n) => typeof n === "number")).toBe(true);
    expect(seqs[seqs.length - 1]).toBeGreaterThan(seqs[0]);
  });
});

describe("límites y errores", () => {
  it("más de 1.000 productos: ordena 1.000 y avisa", async () => {
    const s = setup({ total: 1500 });
    await request(s.win, url("unit_price"));
    expect(s.env.fetched.map(pageOf)).toEqual([1, 2, 3, 4, 5]);
    expect(s.env.posts).toContainEqual(expect.objectContaining({ source: "coto-unit", type: "notice", text: "Se ordenaron los primeros 1.000 productos" }));
  });

  it("si falla una tanda, Coto recibe su respuesta y se avisa", async () => {
    const s = setup({ fetchFails: true });
    const { body } = await request(s.win, url("unit_price"));
    expect(urls(body.response.results)).toEqual(urls(s.all.slice(0, 24)));
    expect(mine(body).status).toBe("selected");
    expect(s.env.posts).toContainEqual(expect.objectContaining({ source: "coto-unit", type: "notice", text: "No se pudo ordenar por precio por kg" }));
  });

  it("respuesta con forma rara: pasa intacta", async () => {
    const raw = JSON.stringify({ algo: "distinto" });
    const s = setup({ serverBody: () => raw });
    const { x } = await request(s.win, url("unit_price"));
    expect(x.responseText).toBe(raw);
  });

  it("pedidos que no son de productos: no se tocan", async () => {
    const s = setup({ serverBody: () => ({ hola: 1 }) });
    const { body } = await request(s.win, API + "recommendations/popular-searches?x=1");
    expect(body).toEqual({ hola: 1 });
    expect(s.env.posts).toHaveLength(0);
  });
});

describe("v2: ofertas, carruseles, bancos, carrito y producto", () => {
  const icbc = { id: "457", bank: "ICBC", days: [1], percent: 30, cap: 20000, capWeekly: false, onlyNoOffer: false };
  const offers = (sort) => `${API}offers/todas-las-ofertas?sort_by=${sort}&sort_order=ascending&page=1&num_results_per_page=24${Q}`;

  it("la página de ofertas también ordena por unidad", async () => {
    const s = setup();
    const { body } = await request(s.win, offers("unit_price"));
    expect(mine(body).status).toBe("selected");
    expect(urls(body.response.results)[0]).toBe("p249");
  });

  it("carruseles: no toca la respuesta y publica etiquetas sin marcas", async () => {
    const s = setup();
    const u = `${API}recommendations/complementarios?item_id=x${Q}`;
    const { x } = await request(s.win, u);
    expect(x.responseText).toBe(JSON.stringify(apiBody(s.all.slice(0, 24), 250)));
    await flush(); await flush();
    const msg = s.env.posts.find((m) => m.type === "labels");
    expect(Object.keys(msg.labels)).toHaveLength(24);
    expect("marks" in msg).toBe(false);
  });

  it("al arrancar publica las promos bancarias", async () => {
    const s = setup();
    await flush();
    const msg = s.env.posts.find((m) => m.type === "promos");
    expect(msg.promos).toHaveLength(14);
  });

  it("con configuración de banco, las etiquetas traen el precio con banco", async () => {
    const s = setup({ settings: { selected: [icbc], day: 1 } });
    await request(s.win, url("unit_price"));
    const msg = s.env.posts.find((m) => m.type === "labels" && m.marks);
    expect(msg.labels.p249).toMatchObject({ bankName: "ICBC", bankValue: 700.7 });
  });

  it("sin configuración espera un rato y sigue sin banco", async () => {
    const s = setup({ settingsWaitMs: 40 });
    const t0 = Date.now();
    await request(s.win, url("price"));
    expect(Date.now() - t0).toBeGreaterThanOrEqual(35);
    const msg = s.env.posts.find((m) => m.type === "labels");
    expect(msg.labels.p0.bankValue).toBeNull();
  });

  it("carrito: no lo toca y publica el análisis", async () => {
    const s = setup({ settings: { selected: [icbc], day: 1 } });
    const u = "https://www.coto.com.ar/rest/model/atg/actors/cCarritoActor/getCarrito?grp=0&pushSite=CotoDigital";
    const { x } = await request(s.win, u);
    expect(x.responseText).toBe(JSON.stringify(CARRITO_BODY));
    await flush(); await flush();
    const msg = s.env.posts.find((m) => m.type === "cart");
    expect(msg.analysis.total).toBeCloseTo(37453.81, 2);
    expect(msg.analysis.today.refund).toBeCloseTo(5554.79, 2);
    expect(s.env.searched).toHaveLength(6);
  });

  it("página de producto: busca por PLU y publica la etiqueta", async () => {
    const s = setup();
    s.send({ type: "lookup", plu: "299912", key: "_/R-00299912-00299912-200" });
    await flush(); await flush();
    const msg = s.env.posts.find((m) => m.type === "labels" && m.labels["_/R-00299912-00299912-200"]);
    expect(msg.labels["_/R-00299912-00299912-200"]).toMatchObject({ group: "kg", take: 3 });
  });
});

describe("fix: revisión final", () => {
  const icbc = { id: "457", bank: "ICBC", days: [1], percent: 30, cap: 20000, capWeekly: false, onlyNoOffer: false };
  const CART_URL = "https://www.coto.com.ar/rest/model/atg/actors/cCarritoActor/getCarrito?grp=0&pushSite=CotoDigital";

  it("al cambiar la configuración vuelve a publicar las etiquetas de la última lista", async () => {
    const s = setup({ settings: { selected: [], day: 1 } });
    await request(s.win, url("price"));
    s.send({ type: "settings", selected: [icbc], day: 1 });
    await flush();
    const last = s.env.posts.filter((m) => m.type === "labels").at(-1);
    expect(last.labels.p0).toMatchObject({ bankName: "ICBC" });
    expect("marks" in last).toBe(false);
  });

  it("fuera de /carrito no busca los productos del carrito", async () => {
    const s = setup({ settings: { selected: [], day: 1 } });
    s.win.location = { pathname: "/productos/x" };
    await request(s.win, CART_URL);
    await flush(); await flush();
    expect(s.env.searched).toHaveLength(0);
    expect(s.env.posts.find((m) => m.type === "cart")).toBeUndefined();
    s.win.location = { pathname: "/carrito" };
    s.send({ type: "cartRequest" });
    await flush(); await flush(); await flush();
    expect(s.env.posts.find((m) => m.type === "cart").analysis.total).toBeCloseTo(37453.81, 2);
  });

  it("busca como mucho 4 productos a la vez", async () => {
    const s = setup({ settings: { selected: [], day: 1 } });
    s.win.location = { pathname: "/carrito" };
    let inFlight = 0, max = 0;
    s.env.onSearch = async () => { inFlight++; max = Math.max(max, inFlight); await flush(); inFlight--; };
    await request(s.win, CART_URL);
    for (let i = 0; i < 10; i++) await flush();
    expect(s.env.searched).toHaveLength(6);
    expect(max).toBeLessThanOrEqual(4);
  });
});

describe("v3: mini-carrito", () => {
  const CART_URL = "https://www.coto.com.ar/rest/model/atg/actors/cCarritoActor/getCarrito?grp=0&pushSite=CotoDigital";

  it("cartRequest analiza el carrito guardado aunque no estés en /carrito", async () => {
    const s = setup({ settings: { selected: [], day: 1 } });
    s.win.location = { pathname: "/productos/x" };
    await request(s.win, CART_URL);
    await flush();
    expect(s.env.posts.find((m) => m.type === "cart")).toBeUndefined();
    s.send({ type: "cartRequest" });
    for (let i = 0; i < 4; i++) await flush();
    expect(s.env.posts.find((m) => m.type === "cart").analysis.total).toBeCloseTo(37453.81, 2);
  });

  it("sin carrito guardado: no hace nada", async () => {
    const s = setup({ settings: { selected: [], day: 1 } });
    s.send({ type: "cartRequest" });
    await flush(); await flush();
    expect(s.env.posts.find((m) => m.type === "cart")).toBeUndefined();
  });
});

describe("revisión final: mini-carrito", () => {
  it("tras un cartRequest, analiza la respuesta nueva del carrito aunque no estés en /carrito", async () => {
    const s = setup({ settings: { selected: [], day: 1 } });
    s.win.location = { pathname: "/productos/x" };
    s.send({ type: "cartRequest" });
    await request(s.win, "https://www.coto.com.ar/rest/model/atg/actors/cCarritoActor/getCarrito?grp=0");
    for (let i = 0; i < 4; i++) await flush();
    expect(s.env.posts.find((m) => m.type === "cart").analysis.total).toBeCloseTo(37453.81, 2);
  });
});

describe("v4: carrito vivo y promos NxM", () => {
  const CART_URL = "https://www.coto.com.ar/rest/model/atg/actors/cCarritoActor/getCarrito?grp=0&pushSite=CotoDigital";
  const ADD_URL = "https://www.coto.com.ar/rest/model/atg/actors/cCarritoActor/addOrRemoveItemToOrderV2?pushSite=CotoDigital";
  const REC_URL = "https://api.coto.com.ar/api/v1/ms-digital-sitio-bff-web/api/v1/products/recommendations/complementarios-pdp?item_id=prod1&us=200";
  const ADEREZO = {
    data: {
      id: "prod00000777", url: "_/R-00000777-00000777-200", sku_display_name: "Aderezo Caesar X 200 Ml",
      product_format: "Mililitros", product_format_quantity: 100,
      price: [{ store: "200", listPrice: 100, formatPrice: 50 }],
      discounts: [{ discountText: "2x1", takingText: "Llevando 2", discountPrice: "$50" }],
    },
  };
  const server = (u) => {
    if (/getCarrito/.test(u)) return CARRITO_BODY;
    if (/addOrRemoveItemToOrderV2/.test(u)) return { codigoError: "0" };
    if (/recommendations/.test(u)) return apiBody([ADEREZO], 1);
    return apiBody([], 0);
  };
  function add(win, payload) {
    return new Promise((resolve) => {
      const x = new win.XMLHttpRequest();
      x.open("POST", ADD_URL);
      x.addEventListener("load", () => resolve(x));
      x.send(typeof payload === "string" ? payload : JSON.stringify(payload));
    });
  }
  const sentQty = (s) => s.sent.filter((r) => /addOrRemove/.test(r.url)).map((r) => JSON.parse(r.payload).quantity);
  const settle = async () => { for (let i = 0; i < 6; i++) await flush(); };

  it("después del primer cartRequest analiza cada carrito nuevo, aunque pase el tiempo", async () => {
    const s = setup({ settings: { selected: [], day: 1 }, serverBody: server });
    s.win.location = { pathname: "/productos/x" };
    s.send({ type: "cartRequest" });
    s.env.time += 10 * 60 * 1000;
    await request(s.win, CART_URL);
    await settle();
    expect(s.env.posts.filter((m) => m.type === "cart")).toHaveLength(1);
  });

  it("agregar un producto también activa el análisis del carrito", async () => {
    const s = setup({ settings: { selected: [], day: 1 }, serverBody: server });
    s.win.location = { pathname: "/productos/x" };
    await add(s.win, { skuId: "sku00577935", prodId: "prod00577935", quantity: 3 });
    await request(s.win, CART_URL);
    await settle();
    expect(s.env.posts.find((m) => m.type === "cart")).toBeDefined();
  });

  it("2x1: al agregar 1 manda 2 y avisa", async () => {
    const s = setup({ settings: { selected: [], day: 1 }, serverBody: server });
    await request(s.win, REC_URL);
    await add(s.win, { skuId: "sku00000777", prodId: "prod00000777", quantity: 1, sucPickUp: null });
    expect(sentQty(s)).toEqual([2]);
    expect(s.env.pins).toEqual([["prod00000777", 1, 2]]);
    const adj = s.env.posts.find((m) => m.type === "promoAdjust");
    expect(adj).toMatchObject({ prodId: "prod00000777", from: 1, quantity: 2 });
    expect(s.env.posts.find((m) => m.type === "promoNotice").text).toBe("Promo 2x1: sumamos 1 gratis");
  });

  it("2x1: clic rápido en + antes del refresco usa la cantidad que mandamos", async () => {
    const s = setup({ settings: { selected: [], day: 1 }, serverBody: server });
    await request(s.win, REC_URL);
    await add(s.win, { prodId: "prod00000777", quantity: 1 });
    await add(s.win, { prodId: "prod00000777", quantity: 3 });
    expect(sentQty(s)).toEqual([2, 4]);
  });

  it("3x2 desconocido: busca por PLU; con 1 solo avisa, con 2 suma el gratis", async () => {
    const s = setup({ settings: { selected: [], day: 1 }, serverBody: server });
    await add(s.win, { prodId: "prod00299912", quantity: 1 });
    await add(s.win, { prodId: "prod00299912", quantity: 2 });
    expect(sentQty(s)).toEqual([1, 3]);
    expect(s.env.posts.find((m) => m.type === "promoNotice").text).toBe("Promo 3x2: llevando 3 pagás 2");
  });

  it("la cantidad anterior sale del carrito", async () => {
    const s = setup({ settings: { selected: [], day: 1 }, serverBody: server });
    await request(s.win, CART_URL); // DOVE 3x2 con 3 unidades
    await settle();
    await add(s.win, { prodId: "prod00299912", quantity: 5 });
    expect(sentQty(s)).toEqual([6]);
  });

  it("bajar, borrar o body raro: se manda tal cual", async () => {
    const s = setup({ settings: { selected: [], day: 1 }, serverBody: server });
    await request(s.win, REC_URL);
    await add(s.win, { prodId: "prod00000777", quantity: 1 });
    await add(s.win, { prodId: "prod00000777", quantity: 1 });
    await add(s.win, { prodId: "prod00000777", quantity: 0 });
    await add(s.win, "no es json");
    expect(s.sent.filter((r) => /addOrRemove/.test(r.url)).at(-1).payload).toBe("no es json");
    expect(s.sent.filter((r) => /addOrRemove/.test(r.url)).slice(0, 3).map((r) => JSON.parse(r.payload).quantity)).toEqual([2, 1, 0]);
  });

  it("con autoPromo apagado no reescribe", async () => {
    const s = setup({ settings: { selected: [], day: 1, autoPromo: false }, serverBody: server });
    await request(s.win, REC_URL);
    await add(s.win, { prodId: "prod00000777", quantity: 1 });
    expect(sentQty(s)).toEqual([1]);
    expect(s.env.posts.find((m) => m.type === "promoAdjust")).toBeUndefined();
  });

  it("si la búsqueda por PLU tarda, manda sin cambios", async () => {
    const s = setup({ settings: { selected: [], day: 1 }, serverBody: server, lookupWaitMs: 5 });
    s.env.onSearch = () => new Promise(() => {});
    await add(s.win, { prodId: "prod00299912", quantity: 2 });
    expect(sentQty(s)).toEqual([2]);
  });

  it("expone datos y ajustes para los clics de promo", async () => {
    const s = setup({ settings: { selected: [], day: 1, autoPromo: false }, serverBody: server });
    await request(s.win, REC_URL);
    expect(s.api.dataFor("prod00000777").sku_display_name).toBe("Aderezo Caesar X 200 Ml");
    expect(s.api.dataFor("prod99")).toBeNull();
    expect(s.api.autoPromo()).toBe(false);
    s.api.notify("prod00000777", "hola");
    expect(s.env.posts.at(-1)).toMatchObject({ type: "promoNotice", text: "hola" });
  });

  it("las etiquetas de carruseles también van por id de producto", async () => {
    const s = setup({ settings: { selected: [], day: 1 }, serverBody: server });
    await request(s.win, REC_URL);
    await settle();
    const labels = s.env.posts.filter((m) => m.type === "labels").at(-1).labels;
    expect(labels.prod00000777).toBeDefined();
    expect(labels["_/R-00000777-00000777-200"]).toBeDefined();
  });
});

describe("revisión v4: clics rápidos y fallas", () => {
  const CART_URL = "https://www.coto.com.ar/rest/model/atg/actors/cCarritoActor/getCarrito?grp=0&pushSite=CotoDigital";
  const ADD_URL = "https://www.coto.com.ar/rest/model/atg/actors/cCarritoActor/addOrRemoveItemToOrderV2?pushSite=CotoDigital";
  const REC_URL = "https://api.coto.com.ar/api/v1/ms-digital-sitio-bff-web/api/v1/products/recommendations/x?item_id=prod1&us=200";
  const ADEREZO = { data: { id: "prod00000777", url: "_/R-00000777-00000777-200", sku_display_name: "Aderezo X 200 Ml", product_format: "Mililitros", product_format_quantity: 100, price: [{ store: "200", listPrice: 100, formatPrice: 50 }], discounts: [{ discountText: "2x1", takingText: "Llevando 2", discountPrice: "$50" }] } };
  let reply = { codigoError: "0" };
  const server = (u) => {
    if (/getCarrito/.test(u)) return CARRITO_BODY;
    if (/addOrRemove/.test(u)) return reply;
    if (/recommendations/.test(u)) return apiBody([ADEREZO], 1);
    return apiBody([], 0);
  };
  const open = (win, payload) => {
    const x = new win.XMLHttpRequest();
    x.open("POST", ADD_URL);
    const done = new Promise((r) => x.addEventListener("load", () => r(x)));
    x.send(JSON.stringify(payload));
    return { x, done };
  };
  const qty = (s) => s.sent.filter((r) => /addOrRemove/.test(r.url)).map((r) => JSON.parse(r.payload).quantity);
  const settle = async () => { for (let i = 0; i < 6; i++) await flush(); };

  it("un '−' después del clic de promo no se reescribe para arriba", async () => {
    reply = { codigoError: "0" };
    const s = setup({ settings: { selected: [], day: 1 }, serverBody: server });
    await request(s.win, REC_URL);
    s.api.expect("prod00000777", 4); // promo-clicks llevó el contador a 4
    await open(s.win, { prodId: "prod00000777", quantity: 3 }).done; // el usuario tocó "−"
    expect(qty(s)).toEqual([3]);
  });

  it("cada pedido nuevo suelta la fijación del contador", async () => {
    const s = setup({ settings: { selected: [], day: 1 }, serverBody: server });
    await open(s.win, { prodId: "prod00577935", quantity: 1 }).done;
    expect(s.env.unpins).toContain("prod00577935");
  });

  it("si Coto rechaza la cantidad ajustada, el próximo intento va sin ajuste", async () => {
    reply = { codigoError: "1", mensajeError: "No se puede confirmar la operacion" };
    const s = setup({ settings: { selected: [], day: 1 }, serverBody: server });
    await request(s.win, REC_URL);
    await open(s.win, { prodId: "prod00000777", quantity: 1 }).done;
    await settle();
    reply = { codigoError: "0" };
    await open(s.win, { prodId: "prod00000777", quantity: 1 }).done;
    expect(qty(s)).toEqual([2, 1]);
  });

  it("un pedido cancelado mientras se busca el producto no se manda", async () => {
    const s = setup({ settings: { selected: [], day: 1 }, serverBody: server });
    let release;
    s.env.onSearch = () => new Promise((r) => { release = r; });
    const { x } = open(s.win, { prodId: "prod00299912", quantity: 2 });
    x.abort();
    release();
    await settle();
    expect(qty(s)).toEqual([]);
  });

  it("un '−' mientras se busca el producto sale después del '+'", async () => {
    const s = setup({ settings: { selected: [], day: 1 }, serverBody: server });
    let release;
    s.env.onSearch = () => new Promise((r) => { release = r; });
    s.api.expect("prod00299912", 2); // el contador está en 2
    open(s.win, { prodId: "prod00299912", quantity: 3 }); // "+": hay que buscar el producto
    open(s.win, { prodId: "prod00299912", quantity: 2 }); // "−" enseguida
    await flush();
    expect(qty(s)).toEqual([]);
    release();
    await settle();
    expect(qty(s)).toEqual([3, 2]);
  });

  it("un carrito viejo no borra la cantidad que mandamos y todavía no confirmó", async () => {
    reply = { codigoError: "0" };
    const s = setup({ settings: { selected: [], day: 1 }, serverBody: server });
    await request(s.win, REC_URL);
    await open(s.win, { prodId: "prod00000777", quantity: 1 }).done; // mandamos 2
    await request(s.win, CART_URL); // carrito sin el aderezo
    await settle();
    await open(s.win, { prodId: "prod00000777", quantity: 1 }).done; // "−" de 2 a 1
    expect(qty(s)).toEqual([2, 1]);
  });
});

describe("v5: más barato de la categoría", () => {
  it("orden nativo: baja la categoría en segundo plano y publica el más barato", async () => {
    const s = setup();
    await request(s.win, url("price"));
    for (let i = 0; i < 6; i++) await flush();
    const best = s.env.posts.filter((m) => m.type === "best").at(-1);
    expect(best.best).toEqual({ p249: "kg" });
    expect(s.env.fetched.map(pageOf)).toEqual([1, 2]);
  });

  it("la caché se comparte: pasar a orden por unidad no vuelve a bajar", async () => {
    const s = setup();
    await request(s.win, url("price"));
    for (let i = 0; i < 6; i++) await flush();
    await request(s.win, url("unit_price"));
    expect(s.env.fetched).toHaveLength(2);
    expect(s.env.posts.filter((m) => m.type === "best").at(-1).best).toEqual({ p249: "kg" });
  });

  it("el ajuste Comunidad cambia la caché y vuelve a publicar el más barato", async () => {
    const s = setup({ settings: { selected: [], day: 1 } });
    await request(s.win, url("price"));
    for (let i = 0; i < 6; i++) await flush();
    const before = s.env.posts.filter((m) => m.type === "best").length;
    s.send({ type: "settings", selected: [], day: 1, comunidad: false });
    for (let i = 0; i < 6; i++) await flush();
    expect(s.env.posts.filter((m) => m.type === "best").length).toBeGreaterThan(before);
    expect(s.env.fetched).toHaveLength(4);
  });
});

describe("revisión v5: más barato", () => {
  it("al llegar una lista nueva, primero borra el cartel viejo", async () => {
    const s = setup();
    await request(s.win, url("price"));
    const bests = s.env.posts.filter((m) => m.type === "best");
    expect(bests[0].best).toEqual({});
  });

  it("con más de 1.000 productos no hay cartel (no vimos la categoría entera)", async () => {
    const s = setup({ total: 1200 });
    await request(s.win, url("price"));
    for (let i = 0; i < 8; i++) await flush();
    expect(s.env.posts.filter((m) => m.type === "best").at(-1).best).toEqual({});
  });

  it("con el cartel apagado no baja la categoría", async () => {
    const s = setup({ settings: { selected: [], day: 1, markBest: false } });
    await request(s.win, url("price"));
    for (let i = 0; i < 6; i++) await flush();
    expect(s.env.fetched).toHaveLength(0);
  });

  it("en búsquedas avisa que es 'de esta lista'", async () => {
    const s = setup();
    await request(s.win, `${API}search/leche?sort_by=price&sort_order=ascending&page=1&num_results_per_page=24${Q}`);
    for (let i = 0; i < 6; i++) await flush();
    expect(s.env.posts.filter((m) => m.type === "best").at(-1).scope).toBe("lista");
  });

  it("el mensaje del más barato lleva un número nuevo al publicarse", async () => {
    const s = setup({ settings: { selected: [], day: 1 } });
    await request(s.win, url("price"));
    for (let i = 0; i < 6; i++) await flush();
    const seqs = s.env.posts.filter((m) => m.type === "best").map((m) => m.seq);
    expect(seqs.at(-1)).toBeGreaterThan(seqs[0]);
  });
});
