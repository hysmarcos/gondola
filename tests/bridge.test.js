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
  it("sin promos muestra cómo cargarlas", async () => {
    document.body.innerHTML = "";
    await renderPopup(document, fakeStorage());
    expect(document.body.textContent).toContain("Abrí coto.com.ar una vez para cargar las promos");
  });

  it("agrupa por banco y guarda lo elegido", async () => {
    document.body.innerHTML = "";
    const st = fakeStorage({ promos: PROMOS, selectedPromoIds: ["457"] });
    await renderPopup(document, st);
    const banks = [...document.querySelectorAll("h2")].map((h) => h.textContent);
    expect(banks).toContain("ICBC");
    expect(banks.filter((b) => b === "Naranja X")).toHaveLength(1);
    const icbc = document.querySelector('input[value="457"]');
    expect(icbc.checked).toBe(true);
    expect(icbc.closest("label").textContent).toContain("Lunes · 30% · tope $20.000");
    const cred = document.querySelector('input[value="449"]');
    cred.checked = true;
    cred.dispatchEvent(new Event("change", { bubbles: true }));
    await tick();
    expect(st.data.selectedPromoIds.sort()).toEqual(["449", "457"]);
    const day = document.querySelector("select#day");
    day.value = "3";
    day.dispatchEvent(new Event("change", { bubbles: true }));
    await tick();
    expect(st.data.day).toBe(3);
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
