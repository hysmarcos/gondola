import { describe, it, expect } from "vitest";
import { createCompareService } from "../src/compare-service.js";
import { createPriceCache } from "../src/price-cache.js";
import { STORES } from "../src/stores.js";

function memStorage() {
  const data = {};
  return {
    get: async (keys) => Object.fromEntries(keys.filter((k) => k in data).map((k) => [k, structuredClone(data[k])])),
    set: async (obj) => Object.assign(data, structuredClone(obj)),
  };
}

const EAN = "7790742348302";

// Fetch falso: busca por EAN y simula carritos. `absent` = EAN que no vuelven; `fail` = hosts con HTTP 500.
function fakeFetch({ absent = [], fail = [], delay = 0, stock = 9 } = {}) {
  const calls = [];
  const active = {};
  const maxActive = {};
  const fn = async (url, init = {}) => {
    const u = new URL(url);
    const host = u.host;
    const isSim = init.method === "POST";
    calls.push({ host, kind: isSim ? "sim" : "search", url, init });
    active[host] = (active[host] || 0) + 1;
    maxActive[host] = Math.max(maxActive[host] || 0, active[host]);
    try {
      if (delay) await new Promise((r) => setTimeout(r, delay));
      if (fail.includes(host) && !isSim) return { ok: false, status: 500, json: async () => ({}) };
      if (isSim) {
        const { quantity, id } = JSON.parse(init.body).items[0];
        return {
          ok: true,
          json: async () => ({
            items: [{ id, quantity, availability: "available" }],
            totals: [{ id: "Items", value: Number(id) * quantity * 100 }],
          }),
        };
      }
      const eans = u.searchParams.getAll("fq").map((f) => f.split(":")[1]).filter((e) => !absent.includes(e));
      return {
        ok: true,
        json: async () =>
          eans.map((ean) => ({
            productName: "P " + ean,
            items: [{ ean, itemId: "1000", sellers: [{ sellerId: "1", commertialOffer: { Price: 1000, AvailableQuantity: stock } }] }],
          })),
      };
    } finally {
      active[host]--;
    }
  };
  fn.calls = calls;
  fn.maxActive = maxActive;
  return fn;
}

const count = (f, host, kind) => f.calls.filter((c) => c.host === host && c.kind === kind).length;
const eanList = (n) => Array.from({ length: n }, (_, i) => String(7790000000000 + i));

describe("createCompareService", () => {
  it("compara un EAN en los 3 super: 1 busqueda + 3 simulaciones por super", async () => {
    const f = fakeFetch();
    const svc = createCompareService({ fetch: f, cache: createPriceCache(memStorage()) });
    const r = await svc.compare([EAN]);
    for (const s of STORES) {
      expect(r[EAN][s.id].unit).toBe(1000);
      expect(count(f, s.host, "search")).toBe(1);
      expect(count(f, s.host, "sim")).toBe(3);
    }
  });

  it("60 EAN hacen 2 busquedas por super", async () => {
    const f = fakeFetch();
    const svc = createCompareService({ fetch: f, cache: createPriceCache(memStorage()) });
    await svc.compare(eanList(60));
    for (const s of STORES) expect(count(f, s.host, "search")).toBe(2);
  });

  it("nunca pasa de 4 consultas activas por host", async () => {
    const f = fakeFetch({ delay: 5 });
    const svc = createCompareService({ fetch: f, cache: createPriceCache(memStorage()) });
    await svc.compare(eanList(30));
    for (const s of STORES) {
      expect(f.maxActive[s.host]).toBeGreaterThan(1);
      expect(f.maxActive[s.host]).toBeLessThanOrEqual(4);
    }
  });

  it("segunda compare con el mismo EAN no llama a fetch", async () => {
    const f = fakeFetch();
    const svc = createCompareService({ fetch: f, cache: createPriceCache(memStorage()) });
    await svc.compare([EAN]);
    const n = f.calls.length;
    const r = await svc.compare([EAN]);
    expect(f.calls.length).toBe(n);
    expect(r[EAN].dia.unit).toBe(1000);
  });

  it("dos compare simultaneas hacen 1 busqueda por super", async () => {
    const f = fakeFetch({ delay: 5 });
    const svc = createCompareService({ fetch: f, cache: createPriceCache(memStorage()) });
    const [a, b] = await Promise.all([svc.compare([EAN]), svc.compare([EAN])]);
    for (const s of STORES) expect(count(f, s.host, "search")).toBe(1);
    expect(a).toEqual(b);
  });

  it("compara solo los súper pedidos", async () => {
    const f = fakeFetch();
    const svc = createCompareService({ fetch: f, cache: createPriceCache(memStorage()) });
    const out = await svc.compare([EAN], ["dia"]);
    expect(Object.keys(out[EAN])).toEqual(["dia"]);
    expect(f.calls.every((c) => c.host === "diaonline.supermercadosdia.com.ar")).toBe(true);
  });

  it("onStatus avisa si cada súper respondió", async () => {
    const f = fakeFetch({ fail: ["www.carrefour.com.ar"] });
    const calls = [];
    const svc = createCompareService({ fetch: f, cache: createPriceCache(memStorage()), onStatus: (id, ok) => calls.push([id, ok]) });
    await svc.compare([EAN]);
    expect(calls).toContainEqual(["carrefour", false]);
    expect(calls).toContainEqual(["dia", true]);
  });

  it("HTTP 500 en dia da error solo ahi y no se guarda", async () => {
    const dia = STORES.find((s) => s.id === "dia");
    const f = fakeFetch({ fail: [dia.host] });
    const svc = createCompareService({ fetch: f, cache: createPriceCache(memStorage()) });
    const r = await svc.compare([EAN]);
    expect(r[EAN].dia).toBe("error");
    expect(r[EAN].carrefour.unit).toBe(1000);
    expect(r[EAN].mas.unit).toBe(1000);
    await svc.compare([EAN]);
    expect(count(f, dia.host, "search")).toBe(2);
    expect(count(f, STORES[0].host, "search")).toBe(1);
  });

  it("busqueda con JSON roto o fetch que lanza da error", async () => {
    const broken = async () => ({ ok: true, json: async () => { throw new Error("bad json"); } });
    const down = async () => { throw new Error("red"); };
    for (const fetch of [broken, down]) {
      const svc = createCompareService({ fetch, cache: createPriceCache(memStorage()) });
      const r = await svc.compare([EAN]);
      expect(Object.values(r[EAN])).toEqual(["error", "error", "error"]);
    }
  });

  it("pasa AbortSignal con tiempo maximo", async () => {
    const signals = [];
    const f = async (url, init) => { signals.push(init?.signal); return { ok: false, json: async () => ({}) }; };
    const svc = createCompareService({ fetch: f, cache: createPriceCache(memStorage()) });
    await svc.compare([EAN]);
    expect(signals.length).toBe(3);
    expect(signals.every((s) => s instanceof AbortSignal)).toBe(true);
  });

  it("EAN que no vuelve en la busqueda es missing y se guarda", async () => {
    const f = fakeFetch({ absent: [EAN] });
    const svc = createCompareService({ fetch: f, cache: createPriceCache(memStorage()) });
    const r = await svc.compare([EAN]);
    expect(r[EAN]).toEqual({ carrefour: "missing", dia: "missing", mas: "missing" });
    const n = f.calls.length;
    await svc.compare([EAN]);
    expect(f.calls.length).toBe(n);
  });

  it("una simulacion fallida cuenta como null para esa q", async () => {
    const base = fakeFetch();
    const f = async (url, init = {}) => {
      if (init.method === "POST" && JSON.parse(init.body).items[0].quantity === 2) throw new Error("x");
      return base(url, init);
    };
    const svc = createCompareService({ fetch: f, cache: createPriceCache(memStorage()) });
    const r = await svc.compare([EAN]);
    expect(r[EAN].dia.unit).toBe(1000);
  });

  it("filtra EAN invalidos y repetidos", async () => {
    const f = fakeFetch();
    const svc = createCompareService({ fetch: f, cache: createPriceCache(memStorage()) });
    const r = await svc.compare(["abc", "", EAN, EAN]);
    expect(Object.keys(r)).toEqual([EAN]);
  });

  it("limita a 200 EAN por llamada", async () => {
    const f = fakeFetch();
    const svc = createCompareService({ fetch: f, cache: createPriceCache(memStorage()) });
    const r = await svc.compare(eanList(250));
    expect(Object.keys(r).length).toBe(200);
  });

  it("si cache.get rechaza, consulta todo y no falla", async () => {
    const f = fakeFetch();
    const cache = { get: async () => { throw new Error("storage"); }, set: async () => {} };
    const svc = createCompareService({ fetch: f, cache });
    const r = await svc.compare([EAN]);
    expect(r[EAN].mas.unit).toBe(1000);
    expect(count(f, STORES[0].host, "search")).toBe(1);
  });

  it("si cache.set rechaza, igual devuelve los resultados", async () => {
    const f = fakeFetch();
    const cache = { get: async () => ({}), set: async () => { throw new Error("quota"); } };
    const svc = createCompareService({ fetch: f, cache });
    const r = await svc.compare([EAN]);
    expect(r[EAN].carrefour.unit).toBe(1000);
    expect(r[EAN].dia.unit).toBe(1000);
  });

  it("nunca manda cookies a los otros super (busqueda y simulacion)", async () => {
    const f = fakeFetch();
    const svc = createCompareService({ fetch: f, cache: createPriceCache(memStorage()) });
    await svc.compare([EAN]);
    for (const kind of ["search", "sim"]) {
      const calls = f.calls.filter((c) => c.kind === kind);
      expect(calls.length).toBeGreaterThan(0);
      expect(calls.every((c) => c.init.credentials === "omit")).toBe(true);
    }
  });

  it("sin stock en la busqueda es missing sin simular", async () => {
    const f = fakeFetch({ stock: 0 });
    const svc = createCompareService({ fetch: f, cache: createPriceCache(memStorage()) });
    const r = await svc.compare([EAN]);
    expect(r[EAN]).toEqual({ carrefour: "missing", dia: "missing", mas: "missing" });
    expect(f.calls.filter((c) => c.kind === "sim").length).toBe(0);
  });
});
