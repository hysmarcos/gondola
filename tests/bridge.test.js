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

  it("manda la configuración al arrancar y cuando cambia", async () => {
    const st = fakeStorage({ promos: PROMOS, selectedPromoIds: ["457"], day: 1 });
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
  it("manda los ajustes del popup: encendidos salvo que se apaguen", async () => {
    const st = fakeStorage({ autoPromo: false });
    const win = fakeWin();
    installBridge(win, st, () => 0);
    await tick();
    expect(win.posted.find((m) => m.type === "settings")).toMatchObject({ autoPromo: false, notifyPromo: true, markBest: true });
    await st.set({ markBest: false });
    await tick();
    expect(win.posted.filter((m) => m.type === "settings").at(-1).markBest).toBe(false);
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

  it("tiene tres pestañas y recuerda la elegida", async () => {
    const st = fakeStorage({ promos: PROMOS });
    await open(st);
    const tabs = [...document.querySelectorAll('[role="tab"]')];
    expect(tabs.map((t) => t.textContent.trim())).toEqual(["Tarjetas", "Ajustes", "Ayuda"]);
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
    auto.checked = false;
    await change(auto);
    expect(st.data.autoPromo).toBe(false);
  });

  it("ayuda dice que no es de Coto y la versión", async () => {
    await open(fakeStorage({ promos: PROMOS }));
    const help = document.querySelector('[data-view="ayuda"]').textContent;
    expect(help).toContain("No afiliado a Coto");
    expect(help).toContain("0.4.0");
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
