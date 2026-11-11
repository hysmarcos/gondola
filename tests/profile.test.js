import { describe, it, expect } from "vitest";
import { profileOf, installProfile } from "../src/profile.js";

function fakeStorage(initial = {}) {
  const data = { ...initial };
  const listeners = [];
  return {
    data,
    get: async (keys) => Object.fromEntries(keys.filter((k) => k in data).map((k) => [k, data[k]])),
    set: async (obj) => {
      Object.assign(data, obj);
      listeners.forEach((fn) => fn(Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, { newValue: v }]))));
    },
    onChanged: { addListener: (fn) => listeners.push(fn) },
  };
}
const tick = () => new Promise((r) => setTimeout(r, 0));

describe("perfil personal: se lee directo de storage, sin pasar por la página", () => {
  it("profileOf: apagado por defecto y solo alergias conocidas", () => {
    expect(profileOf({})).toEqual({ celiac: false, sodium: false, sugar: false, allergens: [] });
    expect(profileOf({ profileCeliac: true, profileAllergens: ["milk", "x"] })).toEqual({ celiac: true, sodium: false, sugar: false, allergens: ["milk"] });
  });

  it("installProfile avisa al arrancar y cuando cambia una clave del perfil", async () => {
    const st = fakeStorage({ profileSodium: true });
    const seen = [];
    installProfile(st, (p) => seen.push(p));
    await tick();
    expect(seen.at(-1).sodium).toBe(true);
    await st.set({ profileAllergens: ["peanuts"] });
    await tick();
    expect(seen.at(-1).allergens).toEqual(["peanuts"]);
    const n = seen.length;
    await st.set({ day: 3 });
    await tick();
    expect(seen).toHaveLength(n);
  });
});
