// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { installBridge, resolveDay } from "../src/bridge.js";
import { renderPopup } from "../src/popup.js";
import { parsePromos } from "../src/banks.js";
import { PROMOS_RESULT } from "./fixtures/promos.js";

const PROMOS = parsePromos(PROMOS_RESULT);
const tick = () => new Promise((r) => setTimeout(r, 0));

function fakeStorage(initial = {}) {
  const data = { ...initial };
  const listeners = [];
  return {
    data,
    get: async (keys) => Object.fromEntries(keys.filter((k) => k in data).map((k) => [k, data[k]])),
    set: async (obj) => {
      Object.assign(data, obj);
      listeners.forEach((fn) => fn(obj));
    },
    onChanged: { addListener: (fn) => listeners.push(fn) },
  };
}

function fakeWin() {
  const win = new EventTarget();
  win.posted = [];
  win.postMessage = (m) => win.posted.push(m);
  win.send = (data) => win.dispatchEvent(new MessageEvent("message", { data: { source: "coto-unit", ...data } }));
  return win;
}

describe("resolveDay", () => {
  it("'hoy' es el día actual", () => {
    expect(resolveDay("hoy")).toBe(new Date().getDay());
    expect(resolveDay(undefined)).toBe(new Date().getDay());
    expect(resolveDay(2)).toBe(2);
  });
});

describe("installBridge", () => {
  it("guarda las promos que publica la página", async () => {
    const st = fakeStorage();
    const win = fakeWin();
    installBridge(win, st, () => 123);
    win.send({ type: "promos", promos: PROMOS });
    await tick();
    expect(st.data.promos).toHaveLength(14);
    expect(st.data.fetchedAt).toBe(123);
  });

  it("manda qué súper se comparan y reenvía si cambian", async () => {
    const st = fakeStorage({ storesOff: ["mas"] });
    const win = fakeWin();
    installBridge(win, st, () => 0);
    await tick();
    expect(win.posted.find((m) => m.type === "settings").stores).toEqual(["carrefour", "dia"]);
    await st.set({ storesOff: ["mas", "dia"] });
    await tick();
    expect(win.posted.at(-1).stores).toEqual(["carrefour"]);
  });

  it("con compareStores apagado no manda ningún súper", async () => {
    const st = fakeStorage({ compareStores: false });
    const win = fakeWin();
    installBridge(win, st, () => 0);
    await tick();
    expect(win.posted.find((m) => m.type === "settings").stores).toEqual([]);
  });

  it("manda la configuración al arrancar y cuando cambia", async () => {
    const st = fakeStorage({ promos: PROMOS, selectedPromoIds: ["457"], day: 1, comunidad: false });
    const win = fakeWin();
    installBridge(win, st, () => 0);
    await tick();
    const first = win.posted.find((m) => m.type === "settings");
    expect(first.day).toBe(1);
    expect(first.selected.map((p) => p.id)).toEqual(["457"]);
    await st.set({ selectedPromoIds: ["457", "449"] });
    await tick();
    const last = win.posted.filter((m) => m.type === "settings").at(-1);
    expect(last.selected.map((p) => p.id)).toEqual(["457", "449"]);
  });
  it("la promo de Comunidad sale del ajuste, no de las tarjetas elegidas", async () => {
    // Elegida a mano pero con el ajuste apagado: no va. Sin elegir y con el ajuste prendido: va.
    const st = fakeStorage({ promos: PROMOS, selectedPromoIds: ["468"], comunidad: false });
    const win = fakeWin();
    installBridge(win, st, () => 0);
    await tick();
    expect(win.posted.find((m) => m.type === "settings").selected).toEqual([]);
    await st.set({ comunidad: true, selectedPromoIds: [] });
    await tick();
    expect(win.posted.filter((m) => m.type === "settings").at(-1).selected.map((p) => p.id)).toEqual(["468"]);
  });
  it("el popup no lista Comunidad en Tarjetas", async () => {
    await renderPopup(document, fakeStorage({ promos: PROMOS }), {});
    const banks = [...document.querySelectorAll('[data-view="tarjetas"] .bank-name')].map((e) => e.textContent);
    expect(banks.length).toBeGreaterThan(0);
    expect(banks).not.toContain("Comunidad Coto");
  });
  it("manda los ajustes del popup: encendidos salvo que se apaguen", async () => {
    const st = fakeStorage({ autoPromo: false });
    const win = fakeWin();
    installBridge(win, st, () => 0);
    await tick();
    expect(win.posted.find((m) => m.type === "settings")).toMatchObject({ autoPromo: false, notifyPromo: true, markBest: true, comunidad: true });
    await st.set({ markBest: false });
    await tick();
    expect(win.posted.filter((m) => m.type === "settings").at(-1).markBest).toBe(false);
  });
});

describe("v5: ajuste comparar con otros súper", () => {
  it("compareStores viene de storage; sin la clave, encendido", async () => {
    const win = fakeWin();
    installBridge(win, fakeStorage({ compareStores: false }), () => 0);
    await tick();
    expect(win.posted.find((m) => m.type === "settings").compareStores).toBe(false);
    const win2 = fakeWin();
    const st = fakeStorage();
    installBridge(win2, st, () => 0);
    await tick();
    expect(win2.posted.find((m) => m.type === "settings").compareStores).toBe(true);
    await st.set({ compareStores: false });
    await tick();
    expect(win2.posted.filter((m) => m.type === "settings").at(-1).compareStores).toBe(false);
  });
});

describe("ajuste información nutricional", () => {
  it("nutrition viene de storage; sin la clave, encendido; un cambio reenvía", async () => {
    const win = fakeWin();
    installBridge(win, fakeStorage({ nutrition: false }), () => 0);
    await tick();
    expect(win.posted.find((m) => m.type === "settings").nutrition).toBe(false);
    const win2 = fakeWin();
    const st = fakeStorage();
    installBridge(win2, st, () => 0);
    await tick();
    expect(win2.posted.find((m) => m.type === "settings").nutrition).toBe(true);
    await st.set({ nutrition: false });
    await tick();
    expect(win2.posted.filter((m) => m.type === "settings").at(-1).nutrition).toBe(false);
  });

  it("el popup tiene el ajuste Información nutricional, encendido", async () => {
    await renderPopup(document, fakeStorage(), { version: "1" });
    const box = document.querySelector('input[name="nutrition"]');
    expect(box).not.toBeNull();
    expect(box.checked).toBe(true);
    expect(box.closest("label").textContent).toContain("Información nutricional");
  });
});

describe("perfil personal", () => {
  it("el puente NO manda el perfil: la página de Coto puede leer esos mensajes", async () => {
    const win = fakeWin();
    installBridge(win, fakeStorage({ profileCeliac: true, profileAllergens: ["milk"] }), () => 0);
    await tick();
    const m = win.posted.find((x) => x.type === "settings");
    expect(m.profile).toBeUndefined();
    expect(JSON.stringify(m)).not.toContain("milk");
  });

  it("el popup tiene 'Mi perfil' apagado y guarda las alergias elegidas", async () => {
    const st = fakeStorage();
    await renderPopup(document, st, { version: "1" });
    expect(document.body.textContent).toContain("Mi perfil");
    expect(document.body.textContent).toContain("No es consejo médico.");
    const celiac = document.querySelector('input[name="profileCeliac"]');
    expect(celiac.checked).toBe(false);
    celiac.click();
    await tick();
    expect(st.data.profileCeliac).toBe(true);
    const milk = document.querySelector('input[name="profileAllergens"][value="milk"]');
    expect(milk.closest("label").textContent).toContain("Leche");
    milk.click();
    await tick();
    document.querySelector('input[name="profileAllergens"][value="peanuts"]').click();
    await tick();
    // En el orden de la tabla de alérgenos (Maní antes que Leche).
    expect(st.data.profileAllergens).toEqual(["peanuts", "milk"]);
    expect(document.querySelectorAll('input[name="profileAllergens"]')).toHaveLength(14);
  });
});

describe("popup", () => {
  const open = async (st, meta = { version: "0.4.0" }) => {
    document.body.innerHTML = "";
    await renderPopup(document, st, meta);
  };
  const click = async (el) => { el.click(); await tick(); };
  const change = async (el) => { el.dispatchEvent(new Event("change", { bubbles: true })); await tick(); };

  it("sin promos muestra cómo cargarlas", async () => {
    await open(fakeStorage());
    expect(document.body.textContent).toContain("Abrí coto.com.ar una vez para cargar las promos");
  });

  it("tiene cuatro pestañas y recuerda la elegida", async () => {
    const st = fakeStorage({ promos: PROMOS });
    await open(st);
    const tabs = [...document.querySelectorAll('[role="tab"]')];
    expect(tabs.map((t) => t.textContent.trim())).toEqual(["Tarjetas", "Ajustes", "Colaborá", "Ayuda"]);
    expect(tabs[0].getAttribute("aria-selected")).toBe("true");
    expect(document.querySelector('[role="tabpanel"]:not([hidden])').dataset.view).toBe("tarjetas");
    await click(tabs[1]);
    expect(tabs[1].getAttribute("aria-selected")).toBe("true");
    expect(document.querySelector('[role="tabpanel"]:not([hidden])').dataset.view).toBe("ajustes");
    expect(st.data.popupTab).toBe("ajustes");
    await open(st);
    expect(document.querySelector('[role="tabpanel"]:not([hidden])').dataset.view).toBe("ajustes");
  });

  it("agrupa por banco y guarda lo elegido", async () => {
    const st = fakeStorage({ promos: PROMOS, selectedPromoIds: ["457"] });
    await open(st);
    const banks = [...document.querySelectorAll(".bank-name")].map((h) => h.textContent);
    expect(banks).toContain("ICBC");
    expect(banks.filter((b) => b === "Naranja X")).toHaveLength(1);
    const icbc = document.querySelector('input[value="457"]');
    expect(icbc.checked).toBe(true);
    expect(icbc.getAttribute("role")).toBe("switch");
    expect(icbc.closest("label").textContent).toContain("Lunes · 30% · tope $20.000");
    expect(icbc.closest("details").open).toBe(true);
    const cred = document.querySelector('input[value="449"]');
    cred.checked = true;
    await change(cred);
    expect(st.data.selectedPromoIds.sort()).toEqual(["449", "457"]);
    expect(document.querySelector(".summary").textContent).toBe("2 promos elegidas");
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

  it("el buscador filtra bancos", async () => {
    await open(fakeStorage({ promos: PROMOS }));
    const search = document.querySelector('input[type="search"]');
    search.value = "icb";
    search.dispatchEvent(new Event("input", { bubbles: true }));
    const visible = [...document.querySelectorAll("details.bank:not([hidden]) .bank-name")].map((e) => e.textContent);
    expect(visible).toEqual(["ICBC"]);
    search.value = "zzz";
    search.dispatchEvent(new Event("input", { bubbles: true }));
    expect(document.querySelector(".empty-search").hidden).toBe(false);
  });

  it("los ajustes se guardan y arrancan encendidos", async () => {
    const st = fakeStorage({ promos: PROMOS, markBest: false });
    await open(st);
    const auto = document.querySelector('input[name="autoPromo"]');
    expect(auto.checked).toBe(true);
    expect(document.querySelector('input[name="markBest"]').checked).toBe(false);
    expect(document.querySelector('input[name="comunidad"]').checked).toBe(true);
    auto.checked = false;
    await change(auto);
    expect(st.data.autoPromo).toBe(false);
  });

  const storeRow = (id) => document.querySelector(`[data-store="${id}"]`);

  it("elige con qué súper comparar", async () => {
    const st = fakeStorage({ promos: PROMOS });
    await open(st);
    expect(["carrefour", "dia", "mas"].map((id) => storeRow(id).querySelector("input").checked)).toEqual([true, true, true]);
    expect(storeRow("dia").className).toBe("row row--sub");
    const dia = storeRow("dia").querySelector("input");
    dia.checked = false;
    await change(dia);
    expect(st.data.storesOff).toEqual(["dia"]);
    dia.checked = true;
    await change(dia);
    expect(st.data.storesOff).toEqual([]);
  });

  it("con comparar apagado los súper están deshabilitados", async () => {
    await open(fakeStorage({ promos: PROMOS, compareStores: false, storesOff: ["mas"] }));
    for (const id of ["carrefour", "dia", "mas"]) expect(storeRow(id).querySelector("input").disabled).toBe(true);
    expect(storeRow("mas").querySelector("input").checked).toBe(false);
  });

  it("apagar y prender comparar habilita las filas", async () => {
    await open(fakeStorage({ promos: PROMOS, compareStores: false }));
    const master = document.querySelector('input[name="compareStores"]');
    master.checked = true;
    await change(master);
    expect(storeRow("dia").querySelector("input").disabled).toBe(false);
  });

  it("un súper que no responde lo dice", async () => {
    await open(fakeStorage({ promos: PROMOS, storeStatus: { mas: "error" } }));
    expect(storeRow("mas").textContent).toContain("No responde");
    expect(storeRow("dia").textContent).not.toContain("No responde");
  });

  it("comparar con otros súper arranca encendido y se guarda", async () => {
    const st = fakeStorage({ promos: PROMOS });
    await open(st);
    const box = document.querySelector('input[name="compareStores"]');
    expect(box.checked).toBe(true);
    expect(box.closest("label").textContent).toContain("Comparar con otros súper");
    box.checked = false;
    await change(box);
    expect(st.data.compareStores).toBe(false);
    await open(st);
    expect(document.querySelector('input[name="compareStores"]').checked).toBe(false);
  });

  it("cada banco lleva su logo", async () => {
    document.body.innerHTML = "";
    const promos = PROMOS.map((p) => ({ ...p, logo: p.logo ?? "logo_icbc_1.png" }));
    await renderPopup(document, fakeStorage({ promos }), { version: "1", logoUrl: (n) => "https://x/" + n });
    const img = document.querySelector("details.bank summary img.bank-logo");
    expect(img.getAttribute("src")).toMatch(/^https:\/\/x\//);
    expect(img.getAttribute("alt")).toBe("");
  });

  it("ayuda dice que no es de Coto y la versión", async () => {
    await open(fakeStorage({ promos: PROMOS }));
    const help = document.querySelector('[data-view="ayuda"]').textContent;
    expect(help).toContain("No afiliado a Coto");
    expect(help).toContain("0.4.0");
  });

  it("colaborá abre los formularios de GitHub en otra pestaña, con la versión", async () => {
    await open(fakeStorage({ promos: PROMOS }));
    const panel = document.querySelector('[data-view="colabora"]');
    const links = [...panel.querySelectorAll("a.contrib-link")];
    expect(links.map((a) => a.querySelector(".contrib-title").textContent)).toEqual(["Reportar un error", "Proponer una mejora", "Pedir otro súper", "Votar ideas"]);
    const bug = new URL(links[0].href);
    expect(bug.origin + bug.pathname).toBe("https://github.com/hysmarcos/gondola/issues/new");
    expect(bug.searchParams.get("template")).toBe("reportar-error.yml");
    expect(bug.searchParams.get("version")).toBe("0.4.0");
    expect(new URL(links[1].href).searchParams.get("template")).toBe("proponer-mejora.yml");
    expect(new URL(links[2].href).searchParams.get("template")).toBe("pedir-super.yml");
    expect(links[3].href).toContain("sort%3Areactions-%2B1-desc");
    for (const a of links) {
      expect(a.target).toBe("_blank");
      expect(a.rel).toBe("noopener noreferrer");
    }
  });
});

describe("fix: promos vacías", () => {
  it("no pisa la lista guardada con una vacía", async () => {
    const st = fakeStorage({ promos: PROMOS });
    const win = fakeWin();
    installBridge(win, st, () => 1);
    win.send({ type: "promos", promos: [] });
    await tick();
    expect(st.data.promos).toHaveLength(14);
  });
});
