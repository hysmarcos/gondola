import { describe, it, expect } from "vitest";
import { cardOf } from "../src/bank-rules/coto.js";
import { migrateCards } from "../src/cards.js";
import { parsePromos } from "../src/banks.js";
import { PROMOS_RESULT } from "./fixtures/promos.js";

const promos = parsePromos(PROMOS_RESULT);
const byId = (id) => promos.find((p) => p.id === id);

describe("cardOf", () => {
  it("saca la tarjeta del logo y el plan del texto", () => {
    expect(cardOf(byId("457"))).toEqual({ cardId: "icbc", plan: "sueldo" });
    expect(cardOf(byId("456"))).toEqual({ cardId: "icbc", plan: null });
    expect(cardOf(byId("465"))).toEqual({ cardId: "supervielle", plan: "identite" });
    expect(cardOf(byId("464"))).toEqual({ cardId: "supervielle", plan: null });
  });
  it("Naranja X: el plan sale del texto y de la observación", () => {
    expect(cardOf(byId("475"))).toEqual({ cardId: "naranjax", plan: "turbo" });
    expect(cardOf(byId("477"))).toEqual({ cardId: "naranjax", plan: "epico" });
    expect(cardOf(byId("473"))).toEqual({ cardId: "naranjax", plan: "inicial" });
  });
  it("sin logo no hay tarjeta", () => {
    expect(cardOf({ logo: null, text: "" })).toBe(null);
    expect(cardOf(null)).toBe(null);
  });
});

describe("migrateCards", () => {
  it("pasa las promos elegidas a tarjetas", () => {
    expect(migrateCards({ selectedPromoIds: ["457", "445"], promos }, cardOf)).toEqual({ icbc: { plan: "sueldo" }, columbia: { plan: null } });
  });
  it("no migra si ya hay cards o no había nada elegido", () => {
    expect(migrateCards({ selectedPromoIds: ["457"], promos, cards: {} }, cardOf)).toBe(null);
    expect(migrateCards({ promos }, cardOf)).toBe(null);
  });
  it("mismo banco con planes distintos: gana el de mayor porcentaje", () => {
    expect(migrateCards({ selectedPromoIds: ["456", "457"], promos }, cardOf)).toEqual({ icbc: { plan: "sueldo" } });
    expect(migrateCards({ selectedPromoIds: ["473", "477"], promos }, cardOf)).toEqual({ naranjax: { plan: "epico" } });
  });
  it("ignora ids que ya no existen y bancos sin tarjeta conocida", () => {
    expect(migrateCards({ selectedPromoIds: ["999", "468"], promos }, cardOf)).toEqual({});
  });
});
