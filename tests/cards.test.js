import { describe, it, expect } from "vitest";
import { CARDS, cleanCards, applies, cotoCards } from "../src/cards.js";

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

// Un banco que Coto trae y no está en CARDS (HSBC hoy, o uno nuevo mañana).
const hsbc = { id: "900", logo: "logo_hsbc_1.png", bank: "HSBC", days: [1], percent: 20, cap: null, text: "Plan Sueldo HSBC", obs: "" };
const nuevo = { id: "901", logo: "logo_bancox2.png", bank: "BANCOX", days: [2], percent: 15, cap: null, text: "", obs: "" };
const comunidad = { id: "468", logo: "logo_comunidad.png", bank: "Comunidad Coto", days: [3], percent: 15, text: "", obs: "" };

describe("cotoCards", () => {
  it("una tarjeta por banco de Coto que no está en CARDS, sin planes y una sola vez", () => {
    expect(cotoCards([hsbc, { ...hsbc, id: "902" }, nuevo, comunidad, { id: "1", logo: "logo_icbc_1.png", bank: "ICBC" }])).toEqual([
      { id: "hsbc", name: "HSBC", plans: [] },
      { id: "bancox", name: "BANCOX", plans: [] },
    ]);
  });
  it("sin promos o con datos rotos no hay ninguna", () => {
    for (const v of [undefined, null, "x", [null, 7, { logo: null }]]) expect(cotoCards(v)).toEqual([]);
  });
});

describe("cleanCards con bancos de Coto fuera de CARDS", () => {
  it("se queda con la tarjeta de un banco que tiene promo en Coto, sin plan", () => {
    expect(cleanCards({ hsbc: { plan: "sueldo" }, icbc: { plan: null } }, [hsbc])).toEqual({ hsbc: { plan: null }, icbc: { plan: null } });
  });
  it("sin la promo de ese banco, o con forma rota, no", () => {
    expect(cleanCards({ hsbc: { plan: null } })).toEqual({});
    expect(cleanCards({ hsbc: 7, bancox: null }, [hsbc, nuevo])).toEqual({});
  });
  it("Comunidad Coto nunca es una tarjeta", () => {
    expect(cleanCards({ comunidad: { plan: null } }, [comunidad])).toEqual({});
  });
});
