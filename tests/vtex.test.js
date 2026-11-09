import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { STORES } from "../src/stores.js";
import { searchUrl, parseSearch, simulationRequest, parseSimulation, bestOffer } from "../src/vtex.js";

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
    expect(hit).toEqual({ itemId: "2", seller: "1", price: 2225, stock: 291, name: "Aceite 900ml" });
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
    expect(bestOffer(hit, sims)).toEqual({ unit: 1899, qty: 2, promo: "Llevando 2…" });
  });
  it("sin simulación de 1 usa el precio de góndola", () => {
    expect(bestOffer(hit, { 1: null })).toEqual({ unit: 2225, qty: 1, promo: null });
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
