import { describe, it, expect } from "vitest";
import { createPriceCache } from "../src/price-cache.js";

function fakeStorage(initial = {}) {
  const data = { ...initial };
  return {
    data,
    get: async (keys) => Object.fromEntries(keys.filter((k) => k in data).map((k) => [k, structuredClone(data[k])])),
    // Asincrónico de verdad: deja pasar un turno entre leer y escribir.
    set: async (obj) => {
      await new Promise((r) => setTimeout(r, 0));
      Object.assign(data, structuredClone(obj));
    },
  };
}

const offer = { unit: 1200, qty: 1, promo: null };
const offer2 = { unit: 900, qty: 2, promo: "2x1" };

describe("createPriceCache", () => {
  it("guarda y devuelve solo las claves pedidas que existen", async () => {
    const cache = createPriceCache(fakeStorage(), () => 1000);
    await cache.set({ "dia:1": offer });
    expect(await cache.get(["dia:1", "dia:2"])).toEqual({ "dia:1": offer });
  });

  it("omite las entradas vencidas", async () => {
    let t = 1000;
    const cache = createPriceCache(fakeStorage(), () => t);
    await cache.set({ "dia:1": offer });
    t = 1000 + 21_600_000;
    expect(await cache.get(["dia:1"])).toEqual({ "dia:1": offer });
    t = 1000 + 21_600_001;
    expect(await cache.get(["dia:1"])).toEqual({});
  });

  it("guarda 'missing' pero ignora 'error'", async () => {
    const storage = fakeStorage();
    const cache = createPriceCache(storage, () => 1000);
    await cache.set({ "dia:1": "missing" });
    await cache.set({ "dia:2": "error" });
    expect(await cache.get(["dia:1", "dia:2"])).toEqual({ "dia:1": "missing" });
    expect(Object.keys(storage.data.cmpCache)).toEqual(["dia:1"]);
  });

  it("con max, descarta las más viejas", async () => {
    let t = 1000;
    const cache = createPriceCache(fakeStorage(), () => t, { max: 2 });
    await cache.set({ "dia:1": offer });
    t = 2000;
    await cache.set({ "dia:2": offer });
    t = 3000;
    await cache.set({ "dia:3": offer2 });
    expect(await cache.get(["dia:1", "dia:2", "dia:3"])).toEqual({ "dia:2": offer, "dia:3": offer2 });
  });

  it("dos set sin await entre medio no se pisan", async () => {
    const cache = createPriceCache(fakeStorage(), () => 1000);
    const a = cache.set({ "dia:1": offer });
    const b = cache.set({ "dia:2": offer2 });
    await Promise.all([a, b]);
    expect(await cache.get(["dia:1", "dia:2"])).toEqual({ "dia:1": offer, "dia:2": offer2 });
  });

  it("un set fallido no bloquea los siguientes", async () => {
    let fail = true;
    const base = fakeStorage();
    const storage = { ...base, set: async (o) => { if (fail) { fail = false; throw new Error("x"); } return base.set(o); } };
    const cache = createPriceCache(storage, () => 1000);
    await expect(cache.set({ "dia:1": offer })).rejects.toThrow();
    await cache.set({ "dia:2": offer });
    expect(await cache.get(["dia:2"])).toEqual({ "dia:2": offer });
  });
});
