import { describe, it, expect, vi } from "vitest";
import { fingerprint } from "../src/bank-rules/hash.js";
import { statusOf, excluded } from "../src/bank-rules/index.js";

// La huella espiada: se ve cuántas veces se calcula.
vi.mock("../src/bank-rules/hash.js", async (orig) => {
  const m = await orig();
  return { ...m, fingerprint: vi.fn(m.fingerprint) };
});

describe("huella por promo", () => {
  it("se calcula una vez por promo, no una por producto", () => {
    const legal = "Válido los martes. No incluye vinos.";
    const rules = { cardOf: () => ({ cardId: "modo", plan: null }), exclusions: [{ hash: fingerprint(legal), test: (p) => /vino/.test(p.name) }] };
    fingerprint.mockClear();
    const promo = { percent: 20, legal };
    expect(statusOf(promo, rules)).toBe("ok");
    for (const name of ["vino tinto", "yerba", "fideos"]) excluded(promo, rules, { name, brand: "", groups: [], onSale: false });
    expect(excluded(promo, rules, { name: "vino blanco", brand: "", groups: [], onSale: false })).toBe(true);
    expect(fingerprint).toHaveBeenCalledTimes(1);
    // Otra promo, otra huella.
    excluded({ percent: 20, legal: "Otro texto." }, rules, { name: "yerba", brand: "", groups: [], onSale: false });
    expect(fingerprint).toHaveBeenCalledTimes(2);
  });

  it("una promo que no es un objeto no rompe", () => {
    const rules = { cardOf: () => ({ cardId: "modo", plan: null }), exclusions: [] };
    expect(excluded(null, rules, { name: "x" })).toBe(true);
  });
});
