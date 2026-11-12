import { describe, it, expect } from "vitest";
import { STORES, enabledStores } from "../src/stores.js";

const ids = (list) => list.map((s) => s.id);

describe("enabledStores", () => {
  it("sin ajustes están los tres súper", () => {
    expect(ids(enabledStores({}))).toEqual(["carrefour", "dia", "mas"]);
  });

  it("saca los súper de storesOff", () => {
    expect(ids(enabledStores({ storesOff: ["mas"] }))).toEqual(["carrefour", "dia"]);
  });

  it("con compareStores apagado no queda ninguno", () => {
    expect(enabledStores({ compareStores: false })).toEqual([]);
  });

  it("un storesOff que no es lista se ignora", () => {
    expect(enabledStores({ storesOff: "x" })).toHaveLength(3);
  });

  it("cada súper trae la página de sus promos bancarias", () => {
    for (const s of STORES) expect(s.promosUrl).toMatch(new RegExp(`^https://${s.host.replace(/\./g, "\.")}/`));
  });
});
