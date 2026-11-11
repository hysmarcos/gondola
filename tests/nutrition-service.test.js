import { describe, it, expect } from "vitest";
import { createNutritionService } from "../src/nutrition-service.js";
import { offApiUrl } from "../src/nutrition.js";
import { OFF } from "./fixtures/off.js";

const EAN = "7790895000997";

// Memoria falsa con la forma de createPriceCache.
function fakeCache(initial = {}) {
  const data = { ...initial };
  const sets = [];
  return {
    data,
    sets,
    get: async (keys) => Object.fromEntries(keys.filter((k) => k in data).map((k) => [k, data[k]])),
    set: async (entries) => {
      sets.push(entries);
      Object.assign(data, entries);
    },
  };
}

// Fetch falso: responde con `status` y `body`, o rechaza si `reject`.
function fakeFetch({ status = 200, body = OFF[EAN], reject = false, delay = 0 } = {}) {
  const calls = [];
  const fn = async (url, init) => {
    calls.push({ url, init });
    if (delay) await new Promise((r) => setTimeout(r, delay));
    if (reject) throw new Error("red caída");
    return { ok: status >= 200 && status < 300, status, json: async () => body };
  };
  fn.calls = calls;
  return fn;
}

describe("createNutritionService", () => {
  it("usa la memoria si la tiene y no llama a fetch", async () => {
    const fetch = fakeFetch();
    const service = createNutritionService({ fetch, cache: fakeCache({ [EAN]: "missing" }) });
    expect(await service.get(EAN)).toBe("missing");
    expect(fetch.calls).toHaveLength(0);
  });

  it("sin memoria pide la URL de la API sin cookies y guarda el resultado", async () => {
    const fetch = fakeFetch();
    const cache = fakeCache();
    const r = await createNutritionService({ fetch, cache }).get(EAN);
    expect(r.per100.kcal).toBeGreaterThan(0);
    expect(fetch.calls[0].url).toBe(offApiUrl(EAN));
    expect(fetch.calls[0].init.credentials).toBe("omit");
    expect(fetch.calls[0].init.signal).toBeDefined();
    expect(cache.sets).toEqual([{ [EAN]: r }]);
  });

  it("404 da missing y se guarda", async () => {
    const cache = fakeCache();
    const r = await createNutritionService({ fetch: fakeFetch({ status: 404, body: { status: 0 } }), cache }).get(EAN);
    expect(r).toBe("missing");
    expect(cache.sets).toEqual([{ [EAN]: "missing" }]);
  });

  it("500, red caída o tiempo máximo dan error y no se guarda", async () => {
    const cache = fakeCache();
    expect(await createNutritionService({ fetch: fakeFetch({ status: 500 }), cache }).get(EAN)).toBe("error");
    expect(await createNutritionService({ fetch: fakeFetch({ reject: true }), cache }).get(EAN)).toBe("error");
    const slow = async (url, init) =>
      new Promise((_, rej) => init.signal.addEventListener("abort", () => rej(init.signal.reason)));
    expect(await createNutritionService({ fetch: slow, cache, timeoutMs: 10 }).get(EAN)).toBe("error");
    expect(cache.sets).toHaveLength(0);
  });

  it("dos pedidos del mismo EAN a la vez hacen un solo fetch", async () => {
    const fetch = fakeFetch({ delay: 5 });
    const service = createNutritionService({ fetch, cache: fakeCache() });
    const [a, b] = await Promise.all([service.get(EAN), service.get(EAN)]);
    expect(fetch.calls).toHaveLength(1);
    expect(a).toEqual(b);
  });

  it("EAN inválido da missing sin pedir", async () => {
    const fetch = fakeFetch();
    expect(await createNutritionService({ fetch, cache: fakeCache() }).get("abc")).toBe("missing");
    expect(fetch.calls).toHaveLength(0);
  });

  it("si la memoria falla igual responde", async () => {
    const broken = { get: async () => { throw new Error("x"); }, set: async () => { throw new Error("x"); } };
    const r = await createNutritionService({ fetch: fakeFetch(), cache: broken }).get(EAN);
    expect(r.per100.kcal).toBeGreaterThan(0);
  });
});

describe("límite de pedidos a la vez", () => {
  it("con muchos EAN distintos, nunca más de 4 pedidos al mismo tiempo", async () => {
    let active = 0;
    let max = 0;
    const fetch = async () => {
      active++;
      max = Math.max(max, active);
      await new Promise((r) => setTimeout(r, 5));
      active--;
      return { ok: true, status: 200, json: async () => ({ status: 0 }) };
    };
    const service = createNutritionService({ fetch, cache: fakeCache() });
    const eans = ["7790000000011", "7790000000028", "7790000000035", "7790000000042", "7790000000059", "7790000000066", "7790000000073"];
    const out = await Promise.all(eans.map((e) => service.get(e)));
    expect(out.every((r) => r === "missing")).toBe(true);
    expect(max).toBeLessThanOrEqual(4);
  });
});
