// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { renderPopup } from "../src/popup.js";
import { cardsView } from "../src/popup-cards.js";
import { parsePromos } from "../src/banks.js";
import { STORES } from "../src/stores.js";
import { PROMOS_RESULT } from "./fixtures/promos.js";

const PROMOS = parsePromos(PROMOS_RESULT);
const tick = () => new Promise((r) => setTimeout(r, 0));
const DIA = STORES.find((s) => s.id === "dia");

function fakeStorage(initial = {}) {
  const data = { ...initial };
  return {
    data,
    get: async (keys) => Object.fromEntries(keys.filter((k) => k in data).map((k) => [k, data[k]])),
    set: async (obj) => { Object.assign(data, obj); },
  };
}

const open = async (st, meta = { version: "0.4.0" }) => {
  document.body.innerHTML = "";
  await renderPopup(document, st, meta);
};
const change = async (el) => { el.dispatchEvent(new Event("change", { bubbles: true })); await tick(); };
const card = (id) => document.querySelector(`details.bank[data-card="${id}"]`);
const line = (id, store) => card(id).querySelector(`.card-store[data-store="${store}"]`);

describe("pestaña Tarjetas", () => {
  it("no lista Comunidad Coto", async () => {
    await open(fakeStorage({ promos: PROMOS }));
    const names = [...document.querySelectorAll('[data-view="tarjetas"] .bank-name')].map((e) => e.textContent);
    expect(names.length).toBeGreaterThan(0);
    expect(names).not.toContain("Comunidad Coto");
  });

  it("una fila por tarjeta, la prendida primero y abierta", async () => {
    await open(fakeStorage({ promos: PROMOS, cards: { icbc: { plan: null } } }));
    const names = [...document.querySelectorAll(".bank-name")].map((h) => h.textContent);
    expect(names[0]).toBe("ICBC");
    expect(names.filter((n) => n === "Naranja X")).toHaveLength(1);
    expect(card("icbc").open).toBe(true);
    expect(card("icbc").querySelector("input.switch").checked).toBe(true);
    expect(card("icbc").querySelector("input.switch").getAttribute("role")).toBe("switch");
    expect(card("columbia").querySelector("input.switch").checked).toBe(false);
    expect(card("columbia").open).toBe(false);
  });

  it("prender ICBC guarda { cards: { icbc: { plan: null } } }", async () => {
    const st = fakeStorage({ promos: PROMOS });
    await open(st);
    expect(document.querySelector(".summary").textContent).toBe("Marcá tus tarjetas");
    const box = card("icbc").querySelector("input.switch");
    box.checked = true;
    await change(box);
    expect(st.data.cards).toEqual({ icbc: { plan: null } });
    expect(document.querySelector(".summary").textContent).toBe("1 tarjeta elegida");
    box.checked = false;
    await change(box);
    expect(st.data.cards).toEqual({});
  });

  it("elegir el chip Plan Sueldo guarda el plan", async () => {
    const st = fakeStorage({ promos: PROMOS, cards: { icbc: { plan: null } } });
    await open(st);
    const chips = [...card("icbc").querySelectorAll(".plans label")].map((l) => l.textContent);
    expect(chips).toEqual(["General", "Plan Sueldo"]);
    expect(card("columbia").querySelector(".plans")).toBeNull();
    const sueldo = card("icbc").querySelector('.plans input[value="sueldo"]');
    sueldo.checked = true;
    await change(sueldo);
    expect(st.data.cards).toEqual({ icbc: { plan: "sueldo" } });
    // La línea de Coto se vuelve a dibujar con la promo del plan.
    expect(line("icbc", "coto").textContent).toContain("30%");
    const general = card("icbc").querySelector('.plans input[value=""]');
    general.checked = true;
    await change(general);
    expect(st.data.cards).toEqual({ icbc: { plan: null } });
    expect(line("icbc", "coto").textContent).not.toContain("30%");
  });

  it("la línea de Coto sigue el plan elegido", async () => {
    await open(fakeStorage({ promos: PROMOS, cards: { naranjax: { plan: "turbo" } } }));
    const text = line("naranjax", "coto").textContent;
    expect(text).toContain("Coto");
    expect(text).toContain("Martes");
    expect(text).toContain("25%");
    expect(text).toContain("tope $9.500");
    expect(text).not.toContain("30%");
    await open(fakeStorage({ promos: PROMOS, cards: { naranjax: { plan: null } } }));
    expect(line("naranjax", "coto").textContent).toContain("sin promo online");
  });

  it("sin tarjetas guardadas parte de las promos elegidas a mano, y guarda en el primer cambio", async () => {
    const st = fakeStorage({ promos: PROMOS, selectedPromoIds: ["457", "445"] });
    await open(st);
    expect(card("icbc").querySelector("input.switch").checked).toBe(true);
    expect(card("columbia").querySelector("input.switch").checked).toBe(true);
    expect(st.data.cards).toBeUndefined();
    const box = card("credicoop").querySelector("input.switch");
    box.checked = true;
    await change(box);
    expect(st.data.cards).toEqual({ icbc: { plan: "sueldo" }, columbia: { plan: null }, credicoop: { plan: null } });
    expect(st.data.selectedPromoIds).toEqual(["457", "445"]);
  });

  it("tarjetas rotas en storage no rompen el popup", async () => {
    await open(fakeStorage({ promos: PROMOS, cards: { inventado: { plan: null }, icbc: { plan: "noexiste" }, tci: 7 } }));
    expect(card("icbc").querySelector("input.switch").checked).toBe(true);
    expect(card("icbc").querySelector('.plans input[value=""]').checked).toBe(true);
    expect(card("tci").querySelector("input.switch").checked).toBe(false);
  });

  it("con otro súper, un plan sin número claro avisa y manda al súper", async () => {
    const storePromos = { dia: [{ promo: { title: "20% - MODO", percent: null }, ref: { cardId: "modo", plan: null }, status: "unclear" }] };
    await open(fakeStorage({ promos: PROMOS, cards: { modo: { plan: null } } }), { version: "1", stores: [DIA], storePromos });
    const l = line("modo", "dia");
    expect(l.textContent).toContain("Día");
    expect(l.textContent).toContain("sin número claro");
    const a = l.querySelector("a");
    expect(a.getAttribute("href")).toBe("https://diaonline.supermercadosdia.com.ar/medios-de-pago-y-promociones");
    expect(a.getAttribute("target")).toBe("_blank");
    expect(a.getAttribute("rel")).toBe("noopener");
    expect(a.textContent).toBe("Ver en Día");
    // MODO no tiene promo en Coto: la línea de Coto va primero y lo dice.
    expect([...card("modo").querySelectorAll(".card-store")].map((x) => x.dataset.store)).toEqual(["coto", "dia"]);
    expect(line("modo", "coto").textContent).toContain("sin promo online");
  });

  it("promo con términos cambiados, y promo ok con su descripción", async () => {
    const storePromos = {
      dia: [
        { promo: { title: "x", percent: 20, days: [3], cap: 8000 }, ref: { cardId: "galicia", plan: null }, status: "ok" },
        { promo: { title: "y", percent: 10 }, ref: { cardId: "galicia", plan: null }, status: "changed" },
      ],
    };
    await open(fakeStorage({ promos: PROMOS, cards: { galicia: { plan: null } } }), { stores: [DIA], storePromos });
    const l = line("galicia", "dia").textContent;
    expect(l).toContain("Miércoles · 20% · tope $8.000");
    expect(l).toContain("los términos cambiaron");
    expect(line("galicia", "dia").querySelector("a")).not.toBeNull();
  });

  it("un súper que no respondió lo dice", async () => {
    await open(fakeStorage({ promos: PROMOS, cards: { icbc: { plan: null } } }), { stores: [DIA], storePromos: { dia: "error" } });
    expect(line("icbc", "dia").textContent).toContain("no responde");
  });

  it("sin datos de otros súper solo aparece la línea de Coto", async () => {
    await open(fakeStorage({ promos: PROMOS, cards: { icbc: { plan: null } } }), { stores: [DIA] });
    expect([...card("icbc").querySelectorAll(".card-store")].map((x) => x.dataset.store)).toEqual(["coto"]);
    expect(document.querySelector(".others")).toBeNull();
  });

  it("una promo unmapped aparece bajo Otras promos, sin interruptor", async () => {
    const storePromos = { dia: [{ promo: { title: "Beneficio Club Día", percent: 10 }, ref: null, status: "unmapped" }] };
    await open(fakeStorage({ promos: PROMOS }), { stores: [DIA], storePromos });
    const others = document.querySelector(".others");
    expect(others.textContent).toContain("Otras promos");
    expect(others.textContent).toContain("Beneficio Club Día");
    expect(others.textContent).toContain("Día");
    expect(others.querySelector("a").getAttribute("href")).toBe(DIA.promosUrl);
    expect(others.querySelector("input")).toBeNull();
  });

  it("si solo hay promos de otros súper, igual se listan las tarjetas", async () => {
    const storePromos = { dia: [{ promo: { title: "20% - MODO", percent: 20 }, ref: { cardId: "modo", plan: null }, status: "ok" }] };
    await open(fakeStorage(), { stores: [DIA], storePromos });
    expect([...document.querySelectorAll(".bank-name")].map((e) => e.textContent)).toEqual(["MODO"]);
  });

  it("elige el día con botones", async () => {
    const st = fakeStorage({ promos: PROMOS, day: 3 });
    await open(st);
    expect(document.querySelector('input[name="day"][value="3"]').checked).toBe(true);
    const hoy = document.querySelector('input[name="day"][value="hoy"]');
    hoy.checked = true;
    await change(hoy);
    expect(st.data.day).toBe("hoy");
  });

  it("el buscador esconde las demás tarjetas", async () => {
    await open(fakeStorage({ promos: PROMOS }));
    const search = document.querySelector('input[type="search"]');
    search.value = "naranja";
    search.dispatchEvent(new Event("input", { bubbles: true }));
    const visible = [...document.querySelectorAll("details.bank:not([hidden]) .bank-name")].map((e) => e.textContent);
    expect(visible).toEqual(["Naranja X"]);
    search.value = "zzz";
    search.dispatchEvent(new Event("input", { bubbles: true }));
    expect(document.querySelector(".empty-search").hidden).toBe(false);
  });

  it("cada banco con promos en Coto lleva su logo", async () => {
    document.body.innerHTML = "";
    const promos = PROMOS.map((p) => ({ ...p, logo: p.logo ?? "logo_icbc_1.png" }));
    await renderPopup(document, fakeStorage({ promos }), { version: "1", logoUrl: (n) => "https://x/" + n });
    const img = document.querySelector("details.bank summary img.bank-logo");
    expect(img.getAttribute("src")).toMatch(/^https:\/\/x\//);
    expect(img.getAttribute("alt")).toBe("");
  });

  it("sin promos muestra cómo cargarlas", () => {
    const nodes = cardsView(document, {}, fakeStorage(), {});
    expect(nodes).toHaveLength(1);
    expect(nodes[0].textContent).toContain("Abrí coto.com.ar una vez para cargar las promos");
  });
});
