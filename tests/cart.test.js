import { describe, it, expect } from "vitest";
import { analyzeCart } from "../src/cart.js";
import { CART_LINES } from "./fixtures/cart.js";
import { parsePromos } from "../src/banks.js";
import { PROMOS_RESULT } from "./fixtures/promos.js";

const ALL = parsePromos(PROMOS_RESULT);
const pick = (...ids) => ALL.filter((p) => ids.includes(p.id));
const MON = 1, TUE = 2;

describe("analyzeCart", () => {
  it("total real con las promos de Coto", () => {
    const a = analyzeCart(CART_LINES, [], MON, "200");
    expect(a.total).toBeCloseTo(37453.55, 2);
    expect(a.lines.every((l) => l.missing === 0)).toBe(true);
    expect(a.today).toBeNull();
    expect(a.best).toBeNull();
  });

  it("promo por cantidad incompleta", () => {
    const lines = CART_LINES.map((l) => (l.id === "prod00299912" ? { ...l, qty: 4 } : l));
    const a = analyzeCart(lines, [], MON, "200");
    const dove = a.lines.find((l) => l.id === "prod00299912");
    expect(dove).toMatchObject({ missing: 2, promoText: "3x2" });
    expect(dove.saving).toBeCloseTo(3 * (2738.99 - 1826.08), 2);
    expect(a.total).toBeCloseTo(37453.55 + 2738.99, 2);
    const two = analyzeCart(CART_LINES.map((l) => (l.id === "prod00299912" ? { ...l, qty: 2 } : l)), [], MON, "200");
    expect(two.lines.find((l) => l.id === "prod00299912").missing).toBe(1);
  });

  it("producto sin datos de búsqueda: precio de lista", () => {
    const lines = CART_LINES.map((l) => (l.id === "prod00608118" ? { ...l, data: null } : l));
    expect(analyzeCart(lines, [], MON, "200").total).toBeCloseTo(37453.55 - 7128.61 + 11882.99, 2);
  });

  it("reintegro del banco con tope", () => {
    const a = analyzeCart(CART_LINES, pick("457"), MON, "200");
    expect(a.today.promo.id).toBe("457");
    expect(a.today.refund).toBeCloseTo(5554.79, 2);
    expect(a.today.total).toBeCloseTo(37453.55 - 5554.79, 2);
    const capped = analyzeCart(CART_LINES, pick("456"), MON, "200");
    expect(capped.today.refund).toBe(3703.19);
    const naranja = analyzeCart(CART_LINES, pick("473"), TUE, "200");
    expect(naranja.today.refund).toBe(3000);
    expect(naranja.weeklyCapBanks).toEqual(["Naranja X"]);
  });

  it("'solo productos sin oferta' deja afuera lo que está en oferta", () => {
    const a = analyzeCart(CART_LINES, pick("440"), MON, "200");
    const eligible = 5750.99 + 4599.98 + 8165;
    expect(a.today.refund).toBeCloseTo(eligible * 0.25, 2);
  });

  it("mejor día", () => {
    const a = analyzeCart(CART_LINES, pick("456", "449"), MON, "200");
    expect(a.best).toMatchObject({ day: TUE });
    expect(a.best.promo.id).toBe("449");
    const tie = analyzeCart(CART_LINES, pick("445", "449"), 4, "200");
    expect(tie.best.day).toBe(4);
  });
});

describe("analyzeCart EAN", () => {
  it("las líneas llevan ean y cmp (null sin datos)", () => {
    const lines = CART_LINES.map((l, i) =>
      i === 0 ? { ...l, data: { ...l.data, product_main_ean: "7790742348302" } } : i === 1 ? { ...l, data: null } : l);
    const a = analyzeCart(lines, [], MON, "200");
    expect(a.lines[0].ean).toBe("7790742348302");
    expect(a.lines[0].cmp).toEqual({ unit: 5750.99, qty: 1 });
    expect(a.lines[1]).toMatchObject({ ean: null, cmp: null });
  });
});

describe("líneas con datos para la información nutricional", () => {
  it("cada línea lleva cantidad, si es comida y el tamaño del envase", () => {
    const a = analyzeCart(CART_LINES, [], 1, "200");
    for (const l of a.lines) {
      expect(typeof l.qty).toBe("number");
      expect(typeof l.nutri).toBe("boolean");
      expect(l.amount === null || typeof l.amount === "number").toBe(true);
    }
  });
});
