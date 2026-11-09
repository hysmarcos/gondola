import { describe, it, expect, beforeEach } from "vitest";
import { installInterceptor } from "../src/interceptor.js";
import { row, apiBody } from "./fixtures/coto.js";

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
  class FakeXHR {
    constructor() {
      this.readyState = 0;
      this.status = 0;
      this.responseType = "";
      this._l = {};
      this._slot = {};
    }
    open(method, u) { this._url = u; this.readyState = 1; }
    addEventListener(t, fn) { (this._l[t] ||= []).push(fn); }
    removeEventListener() {}
    _fire(t) {
      const ev = { type: t, target: this };
      for (const fn of this._l[t] || []) fn.call(this, ev);
      this._slot[t]?.call(this, ev);
    }
    send() {
      seen.push(this._url);
      queueMicrotask(() => {
        const body = server(this._url);
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
  return { FakeXHR, seen };
}

function setup({ total = 250, fetchFails = false, serverBody } = {}) {
  const all = catalog(total);
  const server = serverBody ?? ((u) => {
    const { page, size } = { page: pageOf(u), size: sizeOf(u) };
    return apiBody(all.slice((page - 1) * size, page * size), total);
  });
  const { FakeXHR, seen } = makeFakeXHR(server);
  const env = { time: 0, fetched: [], posts: [] };
  const deps = {
    now: () => env.time,
    post: (m) => env.posts.push(m),
    fetch: async (u) => {
      env.fetched.push(u);
      if (fetchFails) throw new Error("red caída");
      const p = pageOf(u), s = sizeOf(u);
      return { ok: true, json: async () => apiBody(all.slice((p - 1) * s, p * s), total) };
    },
  };
  const win = { XMLHttpRequest: FakeXHR };
  installInterceptor(win, deps);
  return { win, env, seen, all };
}

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
    expect(s.env.fetched).toHaveLength(0);
    expect(s.env.posts).toContainEqual(expect.objectContaining({ source: "coto-unit", type: "labels", active: false }));
  });

  it("orden por unidad: pide todo, ordena y devuelve la página 1", async () => {
    const { body } = await request(s.win, url("unit_price"));
    expect(new URL(s.seen[0]).searchParams.get("sort_by")).toBe("price");
    expect(s.env.fetched.map(pageOf)).toEqual([1, 2]);
    expect(s.env.fetched.map(sizeOf)).toEqual([200, 200]);
    expect(urls(body.response.results)).toEqual(Array.from({ length: 24 }, (_, i) => `p${249 - i}`));
    expect(body.response.total_num_results).toBe(250);
    expect(mine(body).status).toBe("selected");
    const labels = s.env.posts.find((m) => m.type === "labels" && m.active);
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

  it("cada pedido de productos lleva un número creciente", async () => {
    const s = setup();
    await request(s.win, url("price"));
    await request(s.win, url("unit_price"));
    const seqs = s.env.posts.map((m) => m.seq);
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
