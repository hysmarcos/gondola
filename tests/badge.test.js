// @vitest-environment jsdom
import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { installBadges, formatBadge, formatBank, groupMark } from "../src/badge.js";

const KEY = "_/R-00286626-00286626-200";
const KEY2 = "_/R-00012849-00012849-200";

const card = (key) => `
  <div class="producto-card"><constructor-result-item><div class="card-container">
    <a href="/productos/ravioles/${key}"><h3>Ravioles</h3></a>
    <div class="centro-precios"><h4>$3.459</h4><button>Agregar</button></div>
  </div></constructor-result-item></div>`;

const send = (data) => window.dispatchEvent(new MessageEvent("message", { data: { source: "coto-unit", ...data } }));
const tick = () => new Promise((r) => setTimeout(r, 0));
const L1 = { group: "kg", value: 5177.44, drained: false, take: 1, bankValue: 3624.2, bankName: "ICBC" };
const L2 = { group: "kg", value: 9597.08, drained: false, take: 1, bankValue: null, bankName: null };
const text = (sel) => document.querySelector(sel)?.textContent ?? null;

describe("textos", () => {
  it("formatea la línea principal", () => {
    expect(formatBadge({ group: "kg", value: 5177.4, drained: false, take: 1 })).toBe("$5.177/kg final");
    expect(formatBadge({ group: "L", value: 3000, drained: true, take: 1 })).toBe("$3.000/L escurrido");
    expect(formatBadge({ group: "L", value: 1666.08, drained: false, take: 3 })).toBe("$1.666/L llevando 3");
    expect(formatBadge({ group: "unidad", value: 950, drained: false })).toBe("$950/unidad final");
    expect(formatBadge({ group: "sin_dato", value: null })).toBeNull();
    expect(groupMark("L")).toBe("▸ Por litro");
  });

  it("formatea la línea del banco", () => {
    expect(formatBank(L1, 1, 1)).toBe("Hoy con ICBC: $3.624/kg");
    expect(formatBank(L1, 2, 1)).toBe("Martes con ICBC: $3.624/kg");
    expect(formatBank(L2, 1, 1)).toBeNull();
  });
});

describe("installBadges", () => {
  beforeAll(() => installBadges(window, document));
  beforeEach(async () => {
    send({ type: "settings", selected: [], day: new Date().getDay() });
    send({ type: "labels", labels: {}, marks: null, seq: 0 });
    document.body.innerHTML = `<div class="plp-header__sort"><select id="plpSort"></select></div><div id="grid">${card(KEY)}</div>`;
    await tick();
  });

  it("muestra etiqueta y línea de banco sin orden por unidad", async () => {
    send({ type: "labels", labels: { [KEY]: L1 }, marks: null, seq: 1 });
    await tick();
    expect(text(".coto-unit-badge")).toBe("$5.177/kg final");
    expect(text(".coto-unit-bank")).toBe("Hoy con ICBC: $3.624/kg");
    expect(document.querySelector(".coto-unit-mark")).toBeNull();
    const c = document.querySelector(".card-container");
    expect(c.firstElementChild.tagName).toBe("A");
  });

  it("junta etiquetas de varios mensajes (carruseles)", async () => {
    send({ type: "labels", labels: { [KEY]: L1 }, marks: null, seq: 2 });
    send({ type: "labels", labels: { [KEY2]: L2 } });
    document.getElementById("grid").insertAdjacentHTML("beforeend", card(KEY2));
    await tick();
    expect(document.querySelectorAll(".coto-unit-badge")).toHaveLength(2);
    expect(document.querySelectorAll(".coto-unit-bank")).toHaveLength(1);
  });

  it("marcas de grupo: solo del mensaje más nuevo; null las borra", async () => {
    send({ type: "labels", labels: { [KEY]: L1 }, marks: { [KEY]: "kg" }, seq: 10 });
    await tick();
    expect(text(".coto-unit-mark")).toBe("▸ Por kilo");
    send({ type: "labels", labels: { [KEY]: L1 }, marks: null, seq: 9 });
    await tick();
    expect(text(".coto-unit-mark")).toBe("▸ Por kilo");
    send({ type: "labels", labels: { [KEY]: L1 }, marks: null, seq: 11 });
    await tick();
    expect(document.querySelector(".coto-unit-mark")).toBeNull();
  });

  it("aviso: aparece una vez y se va con un orden nativo", async () => {
    send({ type: "notice", text: "Se ordenaron los primeros 1.000 productos", seq: 20 });
    send({ type: "notice", text: "Se ordenaron los primeros 1.000 productos", seq: 20 });
    await tick();
    expect(document.querySelectorAll(".coto-unit-notice")).toHaveLength(1);
    expect(document.querySelector(".coto-unit-notice").previousElementSibling.className).toBe("plp-header__sort");
    send({ type: "labels", labels: {}, marks: null, seq: 21 });
    await tick();
    expect(document.querySelector(".coto-unit-notice")).toBeNull();
  });

  it("ignora mensajes de otros", async () => {
    const KEY3 = "_/R-00000003-00000003-200";
    document.getElementById("grid").innerHTML = card(KEY3);
    window.dispatchEvent(new MessageEvent("message", { data: { source: "otro", type: "labels", labels: { [KEY3]: L1 } } }));
    await tick();
    expect(document.querySelector(".coto-unit-badge")).toBeNull();
  });
});

describe("página de producto", () => {
  it("pide la etiqueta por PLU y la pone después del precio", async () => {
    const posted = [];
    const win = new EventTarget();
    win.location = { pathname: "/productos/ravioles/_/R-00217832-00217832-200" };
    win.postMessage = (m) => posted.push(m);
    win.MutationObserver = window.MutationObserver;
    const doc = document.implementation.createHTMLDocument("pdp");
    doc.body.innerHTML = `<article><h2>Ravioles</h2><div><span class="price h3">$2.738,54</span></div><button>Agregar</button></article>`;
    installBadges(win, doc);
    expect(posted).toContainEqual({ source: "coto-unit", type: "lookup", plu: "217832", key: "_/R-00217832-00217832-200" });
    win.dispatchEvent(new MessageEvent("message", { data: { source: "coto-unit", type: "labels", labels: { "_/R-00217832-00217832-200": L2 } } }));
    await tick();
    const box = doc.querySelector(".coto-unit-pdp");
    expect(box.previousElementSibling.className).toBe("price h3");
    expect(box.querySelector(".coto-unit-badge").textContent).toBe("$9.597/kg final");
  });
});

describe("fix: cambio de configuración", () => {
  it("borra las líneas de banco viejas cuando cambia el día o las promos", async () => {
    const doc = document.implementation.createHTMLDocument("x");
    const win = new EventTarget();
    win.location = { pathname: "/" };
    win.postMessage = () => {};
    win.MutationObserver = window.MutationObserver;
    doc.body.innerHTML = card(KEY);
    installBadges(win, doc);
    const sendW = (data) => win.dispatchEvent(new MessageEvent("message", { data: { source: "coto-unit", ...data } }));
    sendW({ type: "settings", selected: [{ id: "457" }], day: 1 });
    sendW({ type: "labels", labels: { [KEY]: L1 } });
    await tick();
    expect(doc.querySelector(".coto-unit-bank")).not.toBeNull();
    sendW({ type: "settings", selected: [{ id: "457" }], day: 3 });
    await tick();
    expect(doc.querySelector(".coto-unit-bank")).toBeNull();
    expect(doc.querySelector(".coto-unit-badge").textContent).toBe("$5.177/kg final");
  });
});
