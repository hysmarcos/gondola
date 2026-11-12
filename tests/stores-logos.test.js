import { describe, it, expect } from "vitest";
import { readdirSync } from "node:fs";
import { STORES, STORE_LOGOS, storeLogoUrl } from "../src/stores.js";

const getURL = (p) => "chrome-extension://abc/" + p;

describe("logos de los súper", () => {
  it("Coto y cada súper con el que se compara tienen logo empaquetado", () => {
    expect(storeLogoUrl("coto", getURL)).toBe("chrome-extension://abc/assets/stores/coto.png");
    for (const { id } of STORES) expect(storeLogoUrl(id, getURL)).toMatch(/^chrome-extension:\/\/abc\/assets\/stores\/[\w.-]+$/);
  });
  it("un id desconocido o sin getURL no tiene logo", () => {
    expect(storeLogoUrl("otro", getURL)).toBe(null);
    expect(storeLogoUrl("constructor", getURL)).toBe(null);
    expect(storeLogoUrl("coto")).toBe(null);
  });
  it("la lista coincide con assets/stores", () => {
    expect([...STORE_LOGOS].sort()).toEqual(readdirSync("assets/stores").sort());
  });
});
