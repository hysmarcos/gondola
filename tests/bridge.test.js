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
    const st = fakeStorage({ promos: PROMOS, cards: { icbc: { plan: "sueldo" } }, day: 1, comunidad: false });
    const win = fakeWin();
    installBridge(win, st, () => 0);
    await tick();
    const first = win.posted.find((m) => m.type === "settings");
    expect(first.day).toBe(1);
    // Con Plan Sueldo entran las dos promos de ICBC (la de plan y la general).
    expect(first.selected.map((p) => p.id)).toEqual(["457", "456"]);
    await st.set({ cards: { icbc: { plan: "sueldo" }, credicoop: { plan: null } } });
    await tick();
    const last = win.posted.filter((m) => m.type === "settings").at(-1);
    expect(last.selected.map((p) => p.id)).toEqual(["457", "456", "449"]);
    expect(last.cards).toEqual({ icbc: { plan: "sueldo" }, credicoop: { plan: null } });
  });
  it("con la tarjeta sin plan no entra la promo de un plan", async () => {
    const st = fakeStorage({ promos: PROMOS, cards: { icbc: { plan: null } }, comunidad: false });
    const win = fakeWin();
    installBridge(win, st, () => 0);
    await tick();
    expect(win.posted.find((m) => m.type === "settings").selected.map((p) => p.id)).toEqual(["456"]);
  });
  it("migra una sola vez las promos elegidas a tarjetas", async () => {
    const st = fakeStorage({ promos: PROMOS, selectedPromoIds: ["457", "445"], comunidad: false });
    const win = fakeWin();
    installBridge(win, st, () => 0);
    await tick();
    const migrated = { icbc: { plan: "sueldo" }, columbia: { plan: null } };
    expect(st.data.cards).toEqual(migrated);
    expect(win.posted.find((m) => m.type === "settings").cards).toEqual(migrated);
    // Ya migrado: cambiar las promos viejas no toca las tarjetas.
    await st.set({ selectedPromoIds: ["449"] });
    await tick();
    expect(st.data.cards).toEqual(migrated);
  });
  it("tarjetas rotas en storage se ignoran sin romper el puente", async () => {
    const rotas = ["roto", 7, [1], { inventado: { plan: null }, icbc: { plan: "noexiste" }, tci: 7, galicia: null }];
    for (const cards of rotas) {
      const st = fakeStorage({ promos: PROMOS, cards, comunidad: false });
      const win = fakeWin();
      installBridge(win, st, () => 0);
      await tick();
      const m = win.posted.find((x) => x.type === "settings");
      expect(m).toBeTruthy();
      // Solo la ICBC con plan desconocido sobrevive, sin plan.
      expect(m.selected.map((p) => p.id)).toEqual(cards.icbc ? ["456"] : []);
    }
  });
  it("la promo de Comunidad sale del ajuste, no de las tarjetas elegidas", async () => {
    // Elegida a mano pero con el ajuste apagado: no va. Sin elegir y con el ajuste prendido: va.
    const st = fakeStorage({ promos: PROMOS, cards: {}, comunidad: false });
    const win = fakeWin();
    installBridge(win, st, () => 0);
    await tick();
    expect(win.posted.find((m) => m.type === "settings").selected).toEqual([]);
    await st.set({ comunidad: true });
    await tick();
    expect(win.posted.filter((m) => m.type === "settings").at(-1).selected.map((p) => p.id)).toEqual(["468"]);
  });  it("manda los ajustes del popup: encendidos salvo que se apaguen", async () => {
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

  it("la ayuda aclara las promos de otros súper y ya no dice que no tienen descuentos bancarios", async () => {
    await open(fakeStorage({ promos: PROMOS }));
    const help = document.querySelector('[data-view="ayuda"]').textContent;
    expect(help).toContain("Las promos de otros súper son solo de compra online. Los totales no incluyen envío. Si los términos de una promo cambiaron, no se resta.");
    expect(help).not.toContain("Sin descuentos bancarios");
    expect(document.body.textContent).not.toContain("Sin descuentos bancarios");
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
