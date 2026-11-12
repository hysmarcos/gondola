import { describe, it, expect } from "vitest";
import { CARDS, cleanCards, applies } from "../src/cards.js";

describe("CARDS", () => {
  it("trae los bancos y los planes conocidos", () => {
    const by = Object.fromEntries(CARDS.map((c) => [c.id, c.plans.map((p) => p.id)]));
    expect(by.icbc).toEqual(["sueldo"]);
    expect(by.supervielle).toEqual(["identite"]);
    expect(by.naranjax).toEqual(["inicial", "turbo", "epico"]);
    expect(by.masclub).toEqual([]);
    expect(CARDS).toHaveLength(21);
  });
});

describe("applies", () => {
  it("plan null en la promo sirve con cualquier plan", () => {
    expect(applies({ icbc: { plan: "sueldo" } }, { cardId: "icbc", plan: null })).toBe(true);
  });
  it("una promo de un plan no sirve si no tengo ese plan", () => {
    expect(applies({ icbc: { plan: null } }, { cardId: "icbc", plan: "sueldo" })).toBe(false);
    expect(applies({ icbc: { plan: "sueldo" } }, { cardId: "icbc", plan: "sueldo" })).toBe(true);
  });
  it("sin la tarjeta o sin referencia, no", () => {
    expect(applies({}, { cardId: "icbc", plan: null })).toBe(false);
    expect(applies({ icbc: { plan: null } }, null)).toBe(false);
  });
  it("no se confunde con claves heredadas ni con datos rotos", () => {
    expect(applies({}, { cardId: "constructor", plan: null })).toBe(false);
    expect(applies(null, { cardId: "icbc", plan: null })).toBe(false);
    expect(applies({ icbc: null }, { cardId: "icbc", plan: null })).toBe(false);
  });
});

describe("cleanCards", () => {
  it("descarta tarjetas y planes desconocidos", () => {
    expect(cleanCards({ icbc: { plan: "noexiste" }, inventado: { plan: null }, tci: 7 })).toEqual({ icbc: { plan: null } });
    expect(cleanCards({ naranjax: { plan: "turbo" }, tci: null, galicia: { plan: "sueldo" } })).toEqual({ naranjax: { plan: "turbo" }, galicia: { plan: null } });
  });
  it("cualquier cosa que no sea un objeto da {}", () => {
    for (const v of ["roto", 5, null, undefined, [], true, ["icbc"]]) expect(cleanCards(v)).toEqual({});
  });
  it("una tarjeta sin plan queda con plan null", () => {
    expect(cleanCards({ icbc: {} })).toEqual({ icbc: { plan: null } });
  });
});
