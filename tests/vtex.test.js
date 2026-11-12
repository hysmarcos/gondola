import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { STORES } from "../src/stores.js";
import { searchUrl, parseSearch, simulationRequest, parseSimulation, bestOffer, cartSimulationRequest, parseCartSimulation } from "../src/vtex.js";

const store = STORES[0];

describe("searchUrl", () => {
  it("repite fq por EAN y pide hasta 50 productos", () => {
    const url = searchUrl(store, ["111", "222"]);
    expect(url.startsWith(`https://${store.host}/api/catalog_system/pub/products/search?`)).toBe(true);
    expect(url.split("fq=alternateIds_Ean:").length - 1).toBe(2);
    expect(url).toContain("fq=alternateIds_Ean:111&fq=alternateIds_Ean:222");
    expect(url.endsWith("&_from=0&_to=49")).toBe(true);
  });
});

describe("parseSearch", () => {
  it("encuentra el EAN en cualquier item del producto", () => {
    const json = [{
      productName: "Aceite 900ml",
      items: [
        { itemId: "1", ean: "999", sellers: [] },
        { itemId: "2", ean: "123", sellers: [{ sellerId: "1", commertialOffer: { Price: 2225, AvailableQuantity: 291 } }] },
      ],
    }];
    const hit = parseSearch(json).get("123");
    expect(hit).toEqual({ itemId: "2", seller: "1", price: 2225, stock: 291, name: "Aceite 900ml", url: null });
  });
  it("devuelve un Map vacío si no es un array", () => {
    expect(parseSearch({ error: 1 }).size).toBe(0);
  });
});

describe("simulationRequest", () => {
  it("arma el POST con item, cantidad y vendedor", () => {
    const { url, init } = simulationRequest(store, { itemId: "7", seller: "1" }, 2);
    expect(url).toBe(`https://${store.host}/api/checkout/pub/orderForms/simulation?sc=1`);
    expect(init.method).toBe("POST");
    expect(init.headers["content-type"]).toBe("application/json");
    expect(JSON.parse(init.body)).toEqual({ items: [{ id: "7", quantity: 2, seller: "1" }], country: "ARG" });
  });
});

describe("parseSimulation", () => {
  const sim = (over = {}) => ({
    items: [{ quantity: 2, availability: "available" }],
    totals: [{ value: 445000 }, { value: -65000 }],
    ratesAndBenefitsData: { rateAndBenefitsIdentifiers: [{ name: "Llevando 2 a $1899 c/u" }] },
    ...over,
  });
  it("suma los totales en pesos y junta las promos", () => {
    expect(parseSimulation(sim(), 2)).toEqual({ total: 3800, promo: "Llevando 2 a $1899 c/u" });
  });
  it("promo es null si no hay beneficios", () => {
    expect(parseSimulation(sim({ ratesAndBenefitsData: { rateAndBenefitsIdentifiers: [] } }), 2).promo).toBeNull();
  });
  it("devuelve null si la cantidad no coincide", () => {
    expect(parseSimulation(sim({ items: [{ quantity: 1, availability: "available" }] }), 3)).toBeNull();
  });
  it("devuelve null si no está disponible", () => {
    expect(parseSimulation(sim({ items: [{ quantity: 2, availability: "cannotBeDelivered" }] }), 2)).toBeNull();
  });
  it("devuelve null si el total es 0 o no hay items", () => {
    expect(parseSimulation(sim({ totals: [{ value: 0 }] }), 2)).toBeNull();
    expect(parseSimulation({ items: [], totals: [] }, 1)).toBeNull();
  });
});

describe("bestOffer", () => {
  const hit = { itemId: "1", seller: "1", price: 2225, stock: 10, name: "x" };
  it("elige la cantidad con menor precio por unidad", () => {
    const sims = { 1: { total: 2225 }, 2: { total: 3798, promo: "Llevando 2…" }, 3: { total: 6023 } };
    expect(bestOffer(hit, sims)).toEqual({ unit: 1899, qty: 2, promo: "Llevando 2…", url: null });
  });
  it("sin simulación de 1 usa el precio de góndola", () => {
    expect(bestOffer(hit, { 1: null })).toEqual({ unit: 2225, qty: 1, promo: null, url: null });
  });
  it("sin stock no hay oferta", () => {
    expect(bestOffer({ ...hit, stock: 0 }, { 1: { total: 1 } })).toBeNull();
  });
  it("en empate gana la cantidad más chica", () => {
    expect(bestOffer(hit, { 1: { total: 2000 }, 2: { total: 4000 } }).qty).toBe(1);
  });
});

describe("fixtures reales", () => {
  for (const s of STORES) {
    it(`${s.id}: cada producto da una oferta válida`, () => {
      const fx = JSON.parse(readFileSync(`tests/fixtures/vtex-${s.id}.json`, "utf8"));
      const hits = parseSearch(fx.search);
      expect(hits.size).toBeGreaterThan(0);
      for (const [ean, hit] of hits) {
        const sims = {};
        for (const q of [1, 2, 3]) sims[q] = parseSimulation(fx.sims[`${ean}:${q}`], q);
        const offer = bestOffer(hit, sims);
        expect(offer.unit).toBeGreaterThan(0);
        expect([1, 2, 3]).toContain(offer.qty);
      }
    });
  }
});

describe("v9: link del producto en cada súper", () => {
  it("la búsqueda guarda el link y la oferta lo lleva", async () => {
    const { parseSearch, bestOffer } = await import("../src/vtex.js");
    const hits = parseSearch([{ productName: "Leche", link: "https://www.carrefour.com.ar/leche-1l/p", items: [{ ean: "7790001", itemId: "9", sellers: [{ sellerId: "1", commertialOffer: { Price: 2000, AvailableQuantity: 5 } }] }] }]);
    const hit = hits.get("7790001");
    expect(hit.url).toBe("https://www.carrefour.com.ar/leche-1l/p");
    expect(bestOffer(hit, {})).toMatchObject({ unit: 2000, qty: 1, url: "https://www.carrefour.com.ar/leche-1l/p" });
  });
});

describe("cartSimulationRequest", () => {
  it("pide todos los items en un POST a la misma URL de simulación", () => {
    const a = { itemId: "10", seller: "1" };
    const b = { itemId: "20", seller: "2" };
    const { url, init } = cartSimulationRequest(store, [{ hit: a, qty: 2 }, { hit: b, qty: 1 }]);
    expect(url).toBe(simulationRequest(store, a, 1).url);
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({
      items: [{ id: "10", quantity: 2, seller: "1" }, { id: "20", quantity: 1, seller: "2" }],
      country: "ARG",
    });
  });
});

describe("parseCartSimulation", () => {
  const fixture = JSON.parse(readFileSync(new URL("./fixtures/vtex-cart.json", import.meta.url), "utf8"));
  const sum = (json, ids) => (json.totals ?? []).filter((t) => ids.includes(t.id)).reduce((a, t) => a + t.value, 0) / 100;

  for (const id of ["carrefour", "dia", "mas"]) {
    it(`${id}: los totales por item suman lo que dice el pedido`, () => {
      const json = fixture[id].simulation;
      const sim = parseCartSimulation(json);
      const available = json.items.filter((i) => i.availability === "available");
      expect(sim.size).toBe(available.length);
      const total = [...sim.values()].reduce((a, v) => a + v.total, 0);
      expect(Math.abs(total - sum(json, ["Items", "Discounts"]))).toBeLessThanOrEqual(0.01);
    });
  }

  it("Más deja afuera el item que no se puede cumplir", () => {
    const json = fixture.mas.simulation;
    const bad = json.items.find((i) => i.availability !== "available");
    expect(bad).toBeTruthy();
    expect(parseCartSimulation(json).has(String(bad.id))).toBe(false);
  });

  it("total, cantidad y promo de un item", () => {
    const json = { items: [{ id: "9", quantity: 2, availability: "available", sellingPrice: 150000, listPrice: 200000 }] };
    expect(parseCartSimulation(json).get("9")).toEqual({ total: 3000, quantity: 2, onSale: true, list: 4000 });
  });

  it("prefiere priceDefinition.total (promos por cantidad)", () => {
    const json = { items: [{ id: 9, quantity: 3, availability: "available", sellingPrice: 100000, listPrice: 100000, priceDefinition: { total: 250000 } }] };
    expect(parseCartSimulation(json).get("9")).toEqual({ total: 2500, quantity: 3, onSale: false, list: 3000 });
  });

  it("sin stock o sin datos no hay entrada", () => {
    expect(parseCartSimulation({ items: [{ id: "9", quantity: 1, availability: "withoutStock", sellingPrice: 100 }] }).size).toBe(0);
    expect(parseCartSimulation({ items: [{ id: "9", quantity: 1, availability: "available" }] }).size).toBe(0);
    expect(parseCartSimulation(null).size).toBe(0);
    expect(parseCartSimulation({}).size).toBe(0);
  });
});
