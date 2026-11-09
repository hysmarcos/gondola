import { describe, it, expect } from "vitest";
import { parsePromos, bestPromo, dayName } from "../src/banks.js";
import { PROMOS_RESULT } from "./fixtures/promos.js";

const all = parsePromos(PROMOS_RESULT);
const byId = (id) => all.find((p) => p.id === id);

describe("parsePromos", () => {
  it("solo toma las de porcentaje", () => {
    expect(all).toHaveLength(14);
    expect(byId("500")).toBeUndefined();
  });

  it("lee banco, días, porcentaje y tope", () => {
    expect(byId("457")).toMatchObject({ bank: "ICBC", days: [1], percent: 30, cap: 20000, capWeekly: false, onlyNoOffer: false });
    expect(byId("449")).toMatchObject({ bank: "Credicoop", days: [2], percent: 30, cap: null });
    expect(byId("468")).toMatchObject({ bank: "Comunidad Coto", cap: null });
    expect(byId("440")).toMatchObject({ bank: "Ciudad", cap: 30000, onlyNoOffer: true });
    expect(byId("447")).toMatchObject({ bank: "Comafi", percent: 35, cap: 15000 });
    expect(byId("477")).toMatchObject({ bank: "Naranja X", cap: 12000, capWeekly: true });
    expect(byId("475").cap).toBe(9500);
    expect(byId("473").cap).toBe(3000);
  });

  it("tolera datos raros", () => {
    expect(parsePromos(null)).toEqual([]);
    expect(parsePromos({ promocionesDigitales: [{ textoDescuento: "X% DE DESCUENTO", dias: [] }] })).toEqual([]);
  });
});

describe("bestPromo", () => {
  it("elige el mayor porcentaje del día", () => {
    expect(bestPromo(all, 2, false).id).toBe("447");
    expect(bestPromo(all, 1, false).id).toBe("457");
    expect(bestPromo(all, 6, false)).toBeNull();
  });

  it("respeta 'solo productos sin oferta'", () => {
    const ciudad = [byId("440")];
    expect(bestPromo(ciudad, 1, false).id).toBe("440");
    expect(bestPromo(ciudad, 1, true)).toBeNull();
  });

  it("nombra los días", () => {
    expect(dayName(0)).toBe("Domingo");
    expect(dayName(6)).toBe("Sábado");
  });
});
