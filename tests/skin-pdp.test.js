// @vitest-environment jsdom
// Piel Góndola en la página de producto: caja "Con tu banco", comparador en filas con su
// título, y que todo eso desaparezca al apagar la piel. Usa el HTML real de Coto.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { installBadges, formatBankBox } from "../src/badge.js";
import { DOM } from "../src/skin-dom.js";

describe("caja Con tu banco", () => {
  const bank = { bankPrice: 1816.2, bankName: "ICBC", bankPercent: 10 };
  it("sin tarjetas elegidas, invita a elegir", () => {
    expect(formatBankBox({}, false, 4, 4)).toEqual({ kind: "none", text: "Elegí tus tarjetas en el botón de Góndola y vas a ver el precio con el descuento de cada día." });
  });
  it("con promo hoy", () => {
    expect(formatBankBox(bank, true, 4, 4)).toEqual({ kind: "apply", text: "ICBC hoy: 10% · $1.816,20" });
  });
  it("con promo otro día", () => {
    expect(formatBankBox(bank, true, 4, 2).text).toBe("ICBC el jueves: 10% · $1.816,20");
  });
  it("banco que no aplica", () => {
    expect(formatBankBox({ bankBlocked: "oferta" }, true, 4, 4)).toEqual({ kind: "blocked", text: "Banco no aplica: ya está en oferta" });
  });
  it("con tarjetas pero sin promo para este producto: nada", () => {
    expect(formatBankBox({}, true, 4, 4)).toBeNull();
  });
});

const FIXTURE = readFileSync("tests/fixtures/dom/pdp.html", "utf8");
const KEY = "_/R-00508911-00508911-200";
const KEY2 = "_/R-00621756-00621756-200";
const PATH = (key) => `/sitios/cdigi/productos/leche/${key}`;
const EAN = "7790742358608";
const RES = { carrefour: { unit: 2049, qty: 1, promo: null }, dia: { unit: 1899, qty: 1, promo: null }, mas: { unit: 2600, qty: 1, promo: null } };
const tick = () => new Promise((r) => setTimeout(r, 0));

const label = (extra = {}) => ({
  group: "L", value: 2429.11, drained: false, take: 2, note: null, bankValue: null, bankName: null, bankBlocked: null,
  price: 2429.11, list: 3244, via: "oferta", offerText: "25% llevando 2", ean: EAN, cmp: { unit: 2225, qty: 1 }, ...extra,
});
const withBank = (name, percent, price) => label({ bankValue: price, bankName: name, bankPercent: percent, bankPrice: price });

// Comparación ya resuelta: no hace falta esperar pedidos.
const compare = { peek: () => RES, request: () => Promise.resolve(RES) };

function setup({ skin = "pdp", compare: cmp = compare } = {}) {
  const win = new EventTarget();
  win.location = { pathname: PATH(KEY) };
  win.postMessage = () => {};
  win.MutationObserver = window.MutationObserver;
  const doc = document.implementation.createHTMLDocument("x");
  doc.body.innerHTML = FIXTURE;
  if (skin) doc.documentElement.setAttribute("data-gondola-skin", skin);
  const badges = installBadges(win, doc, { compare: cmp });
  const send = (data) => win.dispatchEvent(new MessageEvent("message", { data: { source: "coto-unit", ...data } }));
  return { win, doc, send, badges };
}

// Filas del comparador dibujadas en la caja (no las del panel de la pastilla).
const cmpRows = (doc) => doc.querySelectorAll(".coto-unit-box--pdp > .coto-unit-cmp > .coto-unit-cmp-row");

describe("PDP con la piel", () => {
  it("dibuja Con tu banco, el título del comparador y el comparador en filas", async () => {
    const { doc, send } = setup();
    send({ type: "settings", selected: [{ id: "1" }], day: new Date().getDay() });
    send({ type: "labels", labels: { [KEY]: withBank("ICBC", 10, 1816.2) } });
    await tick();
    const box = doc.querySelector(".coto-unit-box--pdp");
    const bankbox = box.querySelector(":scope > .coto-unit-bankbox");
    expect(bankbox).not.toBeNull();
    expect(bankbox.querySelector(".coto-unit-bankbox-title").textContent).toBe("Con tu banco");
    expect(bankbox.querySelector(".coto-unit-bankbox-text").textContent).toBe("ICBC hoy: 10% · $1.816,20");
    expect(bankbox.getAttribute("data-kind")).toBe("apply");
    expect(cmpRows(doc)).toHaveLength(3);
    expect(box.querySelector(".coto-unit-cmp--icon")).toBeNull();
    const title = box.querySelector(":scope > .coto-unit-cmptitle");
    expect(title.textContent).toBe("El mismo producto en otros súper");
    expect(title.nextElementSibling.classList.contains("coto-unit-cmp")).toBe(true);
    // Lo que la piel no usa sigue en el DOM (lo oculta el CSS): la piel apagada lo necesita.
    expect(box.querySelector(":scope > .coto-unit-cap")).not.toBeNull();
  });

  it("la fila más barata entre los súper más baratos que Coto se marca", async () => {
    const { doc, send } = setup();
    send({ type: "labels", labels: { [KEY]: label() } });
    await tick();
    const best = [...cmpRows(doc)].filter((r) => r.classList.contains("coto-unit-cmp-row--best"));
    expect(best).toHaveLength(1);
    expect(best[0].textContent).toContain("Día");
  });

  it("cada fila con link abre la página de ese súper", async () => {
    const res = { ...RES, carrefour: { ...RES.carrefour, url: "https://www.carrefour.com.ar/leche/p" } };
    const { doc, send } = setup({ compare: { peek: () => res, request: () => Promise.resolve(res) } });
    send({ type: "labels", labels: { [KEY]: label() } });
    await tick();
    const [carrefour, dia] = cmpRows(doc);
    const link = carrefour.querySelector("a.coto-unit-cmp-name");
    expect(link.getAttribute("href")).toBe("https://www.carrefour.com.ar/leche/p");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
    expect(dia.querySelector("a")).toBeNull();
  });

  it("pide la comparación enseguida: la caja (display: contents) no tiene caja que observar", async () => {
    const asked = [];
    const cmp = { peek: () => undefined, request: (ean) => (asked.push(ean), new Promise(() => {})) };
    // Un IntersectionObserver que nunca avisa, como con un nodo sin caja propia.
    class NeverIO { observe() {} unobserve() {} disconnect() {} }
    const win = new EventTarget();
    win.location = { pathname: PATH(KEY) };
    win.postMessage = () => {};
    win.MutationObserver = window.MutationObserver;
    win.IntersectionObserver = NeverIO;
    const doc = document.implementation.createHTMLDocument("x");
    doc.body.innerHTML = FIXTURE;
    doc.documentElement.setAttribute("data-gondola-skin", "pdp");
    installBadges(win, doc, { compare: cmp });
    win.dispatchEvent(new MessageEvent("message", { data: { source: "coto-unit", type: "labels", labels: { [KEY]: label() } } }));
    await tick();
    expect(asked).toEqual([EAN]);
  });

  it("sin tarjetas elegidas, invita a elegirlas", async () => {
    const { doc, send } = setup();
    send({ type: "settings", selected: [], day: 1 });
    send({ type: "labels", labels: { [KEY]: label() } });
    await tick();
    const bankbox = doc.querySelector(".coto-unit-bankbox");
    expect(bankbox.getAttribute("data-kind")).toBe("none");
    expect(bankbox.querySelector(".coto-unit-bankbox-text").textContent).toMatch(/^Elegí tus tarjetas/);
  });

  it("con tarjetas pero sin promo para el producto: sin bloque de banco", async () => {
    const { doc, send } = setup();
    send({ type: "settings", selected: [{ id: "1" }], day: 1 });
    send({ type: "labels", labels: { [KEY]: label() } });
    await tick();
    expect(doc.querySelector(".coto-unit-bankbox")).toBeNull();
  });

  it("sin comparación (sin EAN) no hay título del comparador", async () => {
    const { doc, send } = setup();
    send({ type: "labels", labels: { [KEY]: label({ ean: null }) } });
    await tick();
    expect(doc.querySelector(".coto-unit-cmp")).toBeNull();
    expect(doc.querySelector(".coto-unit-cmptitle")).toBeNull();
  });

  it("los nodos de Coto de la columna de compra siguen siendo los mismos, con el mismo padre", async () => {
    const { doc, send, badges } = setup();
    const picks = [DOM.pdp.title, DOM.pdp.price, DOM.pdp.addButton, DOM.pdp.cuotas, ".mt-4"].map((s) => doc.querySelector(s));
    const parents = picks.map((n) => n.parentElement);
    send({ type: "settings", selected: [{ id: "1" }], day: 1 });
    send({ type: "labels", labels: { [KEY]: withBank("ICBC", 10, 1816.2) } });
    await tick();
    doc.documentElement.removeAttribute("data-gondola-skin");
    badges.refresh();
    await tick();
    const after = [DOM.pdp.title, DOM.pdp.price, DOM.pdp.addButton, DOM.pdp.cuotas, ".mt-4"].map((s) => doc.querySelector(s));
    expect(after).toEqual(picks);
    expect(after.map((n) => n.parentElement)).toEqual(parents);
    expect(picks.every((n) => n.isConnected)).toBe(true);
  });

  it("repintar sin cambios no toca la caja (el observador no entra en bucle)", async () => {
    const { doc, send, badges } = setup();
    send({ type: "settings", selected: [{ id: "1" }], day: 1 });
    send({ type: "labels", labels: { [KEY]: withBank("ICBC", 10, 1816.2) } });
    await tick();
    const records = [];
    const mo = new window.MutationObserver((r) => records.push(...r));
    mo.observe(doc.querySelector(".coto-unit-box--pdp"), { childList: true, subtree: true, attributes: true, characterData: true });
    badges.refresh();
    await tick();
    await Promise.resolve();
    mo.disconnect();
    expect(records).toEqual([]);
  });

  it("otra PDP en los mismos nodos: el banco es el del producto nuevo", async () => {
    const { win, doc, send } = setup();
    send({ type: "settings", selected: [{ id: "1" }], day: new Date().getDay() });
    send({ type: "labels", labels: { [KEY]: withBank("ICBC", 10, 1816.2) } });
    await tick();
    expect(doc.querySelector(".coto-unit-bankbox-text").textContent).toBe("ICBC hoy: 10% · $1.816,20");
    win.location.pathname = PATH(KEY2);
    send({ type: "labels", labels: { [KEY2]: withBank("Galicia", 20, 999.5) } });
    await tick();
    expect(doc.querySelectorAll(".coto-unit-bankbox")).toHaveLength(1);
    expect(doc.querySelector(".coto-unit-bankbox-text").textContent).toBe("Galicia hoy: 20% · $999,50");
  });
});

// Caja de la PDP sin la piel: HTML fijado con el código de antes de la piel (commit c995c57,
// src/badge.js y src/compare-ui.js), con withBank("ICBC", 10, 1816.2), logo del banco y la
// comparación resuelta (con un link).
const BOX_0_12 = "<div class=\"coto-unit-box coto-unit-box--pdp\" data-coto-unit-ean=\"7790742358608\"><div class=\"coto-unit-cap\">Precio real para comparar</div><div class=\"coto-unit-unit\" title=\"Precio por litro para comparar con otros productos\"><span class=\"coto-unit-value\">$1.816 /L</span><span class=\"coto-unit-why\" aria-label=\"con ICBC hoy\" title=\"con ICBC hoy\"><img class=\"coto-unit-logo\" src=\"https://x/logo_icbc_1.png\" alt=\"ICBC\"><span class=\"coto-unit-when\">hoy</span></span></div><div class=\"coto-unit-cmp coto-unit-cmp--icon\" data-state=\"worse\" data-coto-unit-sig=\"[{&quot;kind&quot;:&quot;icon&quot;,&quot;state&quot;:&quot;worse&quot;,&quot;text&quot;:&quot;Más barato en Día&quot;,&quot;label&quot;:&quot;Más barato en Día. Ver comparación&quot;,&quot;rows&quot;:[{&quot;name&quot;:&quot;Coto&quot;,&quot;url&quot;:null,&quot;state&quot;:&quot;coto&quot;,&quot;price&quot;:&quot;$2.225&quot;,&quot;qty&quot;:null,&quot;delta&quot;:null},{&quot;name&quot;:&quot;Carrefour&quot;,&quot;url&quot;:&quot;https://www.carrefour.com.ar/x/p&quot;,&quot;state&quot;:&quot;lower&quot;,&quot;price&quot;:&quot;$2.049&quot;,&quot;qty&quot;:null,&quot;delta&quot;:&quot;−8%&quot;},{&quot;name&quot;:&quot;Día&quot;,&quot;url&quot;:null,&quot;state&quot;:&quot;lower&quot;,&quot;price&quot;:&quot;$1.899&quot;,&quot;qty&quot;:&quot;x2&quot;,&quot;delta&quot;:&quot;−15%&quot;},{&quot;name&quot;:&quot;Más&quot;,&quot;url&quot;:null,&quot;state&quot;:&quot;equal&quot;,&quot;price&quot;:&quot;$2.229&quot;,&quot;qty&quot;:null,&quot;delta&quot;:&quot;igual&quot;}]}]\"><button class=\"coto-unit-cmp-btn\" type=\"button\" aria-label=\"Más barato en Día. Ver comparación\" aria-expanded=\"false\"><svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M3 12V5a2 2 0 0 1 2-2h7l9 9-9 9z\"></path><path d=\"M7.5 7.5h.01\"></path></svg><span class=\"coto-unit-cmp-text\">Más barato en Día</span></button><div class=\"coto-unit-cmp-pop\" role=\"group\" aria-label=\"Mismo producto en otros súper\"><div class=\"coto-unit-cmp-head\">Mismo producto en otros súper</div><div class=\"coto-unit-cmp-row coto-unit-cmp-row--coto\"><span class=\"coto-unit-cmp-name\">Coto</span><span class=\"coto-unit-cmp-price\">$2.225</span></div><div class=\"coto-unit-cmp-row coto-unit-cmp-row--lower\"><a class=\"coto-unit-cmp-name\" href=\"https://www.carrefour.com.ar/x/p\" target=\"_blank\" rel=\"noopener noreferrer\">Carrefour</a><span class=\"coto-unit-cmp-price\">$2.049</span><span class=\"coto-unit-cmp-delta\">−8%</span></div><div class=\"coto-unit-cmp-row coto-unit-cmp-row--lower\"><span class=\"coto-unit-cmp-name\">Día</span><span class=\"coto-unit-cmp-price\">$1.899</span><span class=\"coto-unit-cmp-qty\">x2</span><span class=\"coto-unit-cmp-delta\">−15%</span></div><div class=\"coto-unit-cmp-row coto-unit-cmp-row--equal\"><span class=\"coto-unit-cmp-name\">Más</span><span class=\"coto-unit-cmp-price\">$2.229</span><span class=\"coto-unit-cmp-delta\">igual</span></div></div></div></div>";

describe("PDP sin la piel", () => {
  it("la caja tiene el mismo HTML que antes de la piel", async () => {
    const res = { ...RES, dia: { unit: 1899, qty: 2, promo: "x" }, mas: { unit: 2229, qty: 1, promo: null }, carrefour: { ...RES.carrefour, url: "https://www.carrefour.com.ar/x/p" } };
    const win = new EventTarget();
    win.location = { pathname: PATH(KEY) };
    win.postMessage = () => {};
    win.MutationObserver = window.MutationObserver;
    const doc = document.implementation.createHTMLDocument("x");
    doc.body.innerHTML = FIXTURE;
    installBadges(win, doc, { compare: { peek: () => res, request: () => Promise.resolve(res) }, logoUrl: (n) => (n ? "https://x/" + n : null) });
    const send = (data) => win.dispatchEvent(new MessageEvent("message", { data: { source: "coto-unit", ...data } }));
    send({ type: "settings", selected: [{ id: "1" }], day: new Date().getDay() });
    send({ type: "labels", labels: { [KEY]: { ...withBank("ICBC", 10, 1816.2), bankLogo: "logo_icbc_1.png" } } });
    await tick();
    expect(doc.querySelector(".coto-unit-box--pdp").outerHTML).toBe(BOX_0_12);
  });

  it("no hay piezas nuevas y el comparador es la pastilla", async () => {
    const { doc, send } = setup({ skin: null });
    send({ type: "settings", selected: [], day: 1 });
    send({ type: "labels", labels: { [KEY]: withBank("ICBC", 10, 1816.2) } });
    await tick();
    expect(doc.querySelector(".coto-unit-box--pdp")).not.toBeNull();
    expect(doc.querySelector(".coto-unit-bankbox")).toBeNull();
    expect(doc.querySelector(".coto-unit-cmptitle")).toBeNull();
    expect(cmpRows(doc)).toHaveLength(0);
    expect(doc.querySelector(".coto-unit-box--pdp > .coto-unit-cmp--icon")).not.toBeNull();
  });

  it("apagar la piel con la página abierta: refresh() borra lo nuevo y vuelve la pastilla", async () => {
    const { doc, send, badges } = setup();
    send({ type: "settings", selected: [], day: 1 });
    send({ type: "labels", labels: { [KEY]: label() } });
    await tick();
    expect(doc.querySelector(".coto-unit-bankbox")).not.toBeNull();
    expect(doc.querySelector(".coto-unit-cmptitle")).not.toBeNull();
    expect(cmpRows(doc)).toHaveLength(3);
    doc.documentElement.removeAttribute("data-gondola-skin");
    badges.refresh();
    await tick();
    expect(doc.querySelector(".coto-unit-bankbox")).toBeNull();
    expect(doc.querySelector(".coto-unit-cmptitle")).toBeNull();
    expect(cmpRows(doc)).toHaveLength(0);
    expect(doc.querySelectorAll(".coto-unit-box--pdp > .coto-unit-cmp")).toHaveLength(1);
    expect(doc.querySelector(".coto-unit-box--pdp > .coto-unit-cmp--icon")).not.toBeNull();
    // Y al volver a prenderla, filas de nuevo, sin restos de la pastilla.
    doc.documentElement.setAttribute("data-gondola-skin", "pdp");
    badges.refresh();
    await tick();
    expect(cmpRows(doc)).toHaveLength(3);
    expect(doc.querySelector(".coto-unit-cmp--icon")).toBeNull();
    expect(doc.querySelector(".coto-unit-cmp-btn")).toBeNull();
    expect(doc.querySelectorAll(".coto-unit-box--pdp > .coto-unit-cmp")).toHaveLength(1);
  });
});
