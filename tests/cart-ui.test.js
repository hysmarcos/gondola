// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { installCartUi } from "../src/cart-ui.js";
import { analyzeCart } from "../src/cart.js";
import { CART_LINES } from "./fixtures/cart.js";
import { parsePromos } from "../src/banks.js";
import { PROMOS_RESULT } from "./fixtures/promos.js";

const ALL = parsePromos(PROMOS_RESULT);
const pick = (...ids) => ALL.filter((p) => ids.includes(p.id));
const tick = () => new Promise((r) => setTimeout(r, 0));

function setup(path = "/carrito", total = "$48.355,92", opts = {}) {
  const win = new EventTarget();
  win.location = { pathname: path };
  win.MutationObserver = window.MutationObserver;
  const doc = document.implementation.createHTMLDocument("cart");
  const line = (name) => `<card-product><div class="c__item-detail"><a class="title">  ${name} </a></div><input value="1"></card-product>`;
  doc.body.innerHTML = `
    ${line("JABÓN DE TOCADOR DOVE KARITE  Y VAINILLA 90 G")}
    ${line("Shampoo TRESEMME Keratina Antifrizz 500 Ml")}
    <div class="card-body text-center card-body-container">Total: ${total} <button>Continuar compra</button></div>`;
  installCartUi(win, doc, opts);
  const send = (data) => win.dispatchEvent(new MessageEvent("message", { data: { source: "coto-unit", ...data } }));
  return { win, doc, send };
}

const today = new Date().getDay();
const dove4 = CART_LINES.map((l) => (l.id === "prod00299912" ? { ...l, qty: 4 } : l));

describe("installCartUi", () => {
  it("avisa en la línea con promo incompleta (nombre sin acentos ni mayúsculas)", async () => {
    const { doc, send } = setup("/carrito", "$51.094,91");
    send({ type: "cart", analysis: analyzeCart(dove4, [], today, "200"), seq: 1 });
    await tick();
    const warn = doc.querySelectorAll(".coto-unit-cart-warn");
    expect(warn).toHaveLength(1);
    expect(warn[0].textContent).toBe("⚠ Agregá 2 más y se activa el 3x2: ahorrás $2.739");
    expect(warn[0].closest("card-product").textContent).toContain("DOVE");
  });

  it("caja con total real, banco de hoy y mejor día", async () => {
    const { doc, send } = setup();
    send({ type: "settings", selected: [], day: 1 });
    send({ type: "cart", analysis: analyzeCart(CART_LINES, pick("456", "449"), 1, "200"), seq: 2 });
    await tick();
    const box = doc.querySelector(".coto-unit-cart-box");
    expect(box.previousElementSibling.classList.contains("card-body-container")).toBe(true);
    const lines = [...box.children].map((e) => e.textContent);
    const when = today === 1 ? "Hoy" : "Lunes";
    expect(lines).toEqual([
      "Total con promos de Coto: $37.454",
      `${when} con ICBC: $33.751 (reintegro $3.703)`,
      "Mejor día: martes con Credicoop, $31.899",
    ]);
  });

  it("avisa el tope semanal y no duplica la caja", async () => {
    const { doc, send } = setup();
    send({ type: "settings", selected: [], day: 2 });
    send({ type: "cart", analysis: analyzeCart(CART_LINES, pick("473"), 2, "200"), seq: 3 });
    send({ type: "cart", analysis: analyzeCart(CART_LINES, pick("473"), 2, "200"), seq: 4 });
    await tick();
    expect(doc.querySelectorAll(".coto-unit-cart-box")).toHaveLength(1);
    expect(doc.querySelector(".coto-unit-cart-box").textContent).toContain("El tope de Naranja X es semanal.");
  });

  it("ignora análisis viejos", async () => {
    const { doc, send } = setup("/carrito", "$51.094,91");
    send({ type: "cart", analysis: analyzeCart(dove4, [], today, "200"), seq: 10 });
    send({ type: "cart", analysis: analyzeCart(CART_LINES, [], today, "200"), seq: 9 });
    await tick();
    expect(doc.querySelectorAll(".coto-unit-cart-warn")).toHaveLength(1);
  });

  it("fuera del carrito no hace nada", async () => {
    const { doc, send } = setup("/productos/x");
    send({ type: "cart", analysis: analyzeCart(dove4, [], today, "200"), seq: 1 });
    await tick();
    expect(doc.querySelector(".coto-unit-cart-box, .coto-unit-cart-warn")).toBeNull();
  });
});

describe("fix: total de Coto distinto", () => {
  it("si el total de la página no coincide con el carrito leído, no muestra nada", async () => {
    const { doc, send } = setup();
    doc.querySelector(".card-body-container").firstChild.textContent = "Total: $50.000,00 ";
    send({ type: "cart", analysis: analyzeCart(dove4, [], today, "200"), seq: 1 });
    await tick();
    expect(doc.querySelector(".coto-unit-cart-box, .coto-unit-cart-warn")).toBeNull();
  });
});

describe("mini-carrito", () => {
  const mini = (total) => `
    <cart-float><ul class="dropdown-menu dropdown-carrito show"><div class="productos-carrito">
      <card-product-float><li><a class="producto-carrito"><div class="info-producto">
        <p class="titulo-producto text-truncate"> Jabón De Tocador DOVE Karité Y Vainilla 90 G </p>
        <p class="precio"><span class="precio-final">$8.216,97</span></p></div></a></li></card-product-float>
      <card-product-float><li><a class="producto-carrito"><div class="info-producto">
        <p class="titulo-producto text-truncate"> Bolsa Residuo Grande 60x90 Flowi 10u </p>
        <p class="precio"><span class="precio-final">$4.599,98</span></p></div></a></li></card-product-float>
    </div><div class="precio-carrito"><div class="total-precio"><h4 class="roar-total">${total}</h4></div></div></ul></cart-float>`;

  function setupMini(total = "$48.355,92", path = "/productos/x") {
    const win = new EventTarget();
    win.location = { pathname: path };
    win.posted = [];
    win.postMessage = (m) => win.posted.push(m);
    win.MutationObserver = window.MutationObserver;
    const doc = document.implementation.createHTMLDocument("mini");
    doc.body.innerHTML = `<header></header>`;
    installCartUi(win, doc);
    const send = (data) => win.dispatchEvent(new MessageEvent("message", { data: { source: "coto-unit", ...data } }));
    const open = () => { doc.querySelector("header").innerHTML = mini(total); };
    return { win, doc, send, open };
  }

  it("al abrirse pide el análisis", async () => {
    const { win, open } = setupMini();
    open();
    await tick();
    expect(win.posted).toContainEqual({ source: "coto-unit", type: "cartRequest" });
  });

  it("muestra precio con promo por línea y totales", async () => {
    const { doc, send, open } = setupMini();
    open();
    send({ type: "settings", selected: [], day: 1 });
    send({ type: "cart", analysis: analyzeCart(CART_LINES, pick("457"), 1, "200"), seq: 1 });
    await tick();
    const lines = doc.querySelectorAll(".coto-unit-mini-line");
    expect(lines).toHaveLength(1);
    expect(lines[0].textContent).toBe("$5.478 con promo");
    expect(lines[0].closest("card-product-float").textContent).toContain("DOVE");
    expect(doc.querySelector('.precio-final[data-coto-unit-strike]').textContent).toBe("$8.216,97");
    const total = doc.querySelector(".coto-unit-mini-total");
    expect(total.previousElementSibling.className).toBe("total-precio");
    const when = new Date().getDay() === 1 ? "Hoy" : "Lunes";
    expect([...total.children].map((e) => e.textContent)).toEqual(["Con promos: $37.454", `${when} con ICBC: $31.899`]);
  });

  it("si el total no coincide, no muestra nada", async () => {
    const { doc, send, open } = setupMini("$50.000,00");
    open();
    send({ type: "cart", analysis: analyzeCart(CART_LINES, [], 1, "200"), seq: 1 });
    await tick();
    expect(doc.querySelector(".coto-unit-mini-line, .coto-unit-mini-total")).toBeNull();
  });
});

// Cliente de comparación falso: guarda los pedidos y se resuelve a mano.
function fakeCompare() {
  const done = new Map();
  const waiting = new Map();
  return {
    asked: [],
    peek: (ean) => done.get(ean),
    request(ean) {
      this.asked.push(ean);
      return new Promise((r) => waiting.set(ean, r));
    },
    async resolve(ean, res) {
      done.set(ean, res);
      waiting.get(ean)?.(res);
      await tick();
    },
  };
}

const EAN_DOVE = "7791293031235";
const EAN_TRES = "7791293031242";
const RES = { carrefour: { unit: 2049, qty: 1, promo: null }, dia: { unit: 1899, qty: 2, promo: "x" }, mas: { unit: 2229, qty: 1, promo: null } };
const CMP = { unit: 2225, qty: 1 };

// Análisis del carrito completo con EAN/cmp en Dove (y opcionalmente en Tresemme).
function withEan(both = false) {
  const a = analyzeCart(CART_LINES, [], today, "200");
  a.lines = a.lines.map((l) =>
    l.id === "prod00299912" ? { ...l, ean: EAN_DOVE, cmp: CMP }
      : both && l.id === "prod00608118" ? { ...l, ean: EAN_TRES, cmp: CMP } : l);
  return a;
}
const bests = (doc) => [...doc.querySelectorAll(".coto-unit-cmp-best")].map((e) => e.textContent);

describe("v5: comparar con otros súper en el carrito", () => {
  it("línea con EAN: pide una vez y muestra el mejor súper dentro de .c__item-detail", async () => {
    const compare = fakeCompare();
    const { doc, send } = setup("/carrito", undefined, { compare });
    send({ type: "cart", analysis: withEan(), seq: 1 });
    send({ type: "cart", analysis: withEan(), seq: 2 });
    await tick();
    expect(bests(doc)).toEqual(["…"]);
    await compare.resolve(EAN_DOVE, RES);
    expect(bests(doc)).toEqual(["Día $1.899 ▼"]);
    const best = doc.querySelector(".coto-unit-cmp-best");
    expect(best.closest(".c__item-detail").parentElement.textContent).toContain("DOVE");
    expect(doc.querySelectorAll(".coto-unit-cmp")).toHaveLength(1);
    expect(compare.asked).toEqual([EAN_DOVE]);
  });

  it("línea sin EAN: sin bloque ni pedido", async () => {
    const compare = fakeCompare();
    const { doc, send } = setup("/carrito", undefined, { compare });
    send({ type: "cart", analysis: analyzeCart(CART_LINES, [], today, "200"), seq: 1 });
    await tick();
    expect(doc.querySelector(".coto-unit-cmp")).toBeNull();
    expect(compare.asked).toEqual([]);
  });

  it("sin cliente de comparación no hay bloque", async () => {
    const { doc, send } = setup();
    send({ type: "cart", analysis: withEan(), seq: 1 });
    await tick();
    expect(doc.querySelector(".coto-unit-cmp")).toBeNull();
  });

  it("compareStores: false no pide ni pinta", async () => {
    const compare = fakeCompare();
    const { doc, send } = setup("/carrito", undefined, { compare });
    send({ type: "settings", selected: [], day: 1, compareStores: false });
    send({ type: "cart", analysis: withEan(), seq: 1 });
    await tick();
    expect(doc.querySelector(".coto-unit-cmp")).toBeNull();
    expect(compare.asked).toEqual([]);
  });

  it("al apagar compareStores se borran los bloques y una respuesta tardía no pinta", async () => {
    const compare = fakeCompare();
    const { doc, send } = setup("/carrito", undefined, { compare });
    send({ type: "cart", analysis: withEan(true), seq: 1 });
    await tick();
    await compare.resolve(EAN_DOVE, RES);
    expect(bests(doc)).toEqual(["Día $1.899 ▼", "…"]);
    send({ type: "settings", selected: [], day: 1, compareStores: false });
    expect(doc.querySelector(".coto-unit-cmp")).toBeNull();
    await compare.resolve(EAN_TRES, RES);
    expect(doc.querySelector(".coto-unit-cmp")).toBeNull();
    // Al volver a encender se pinta con lo ya sabido, sin pedir de nuevo.
    send({ type: "settings", selected: [], day: 1, compareStores: true });
    expect(bests(doc)).toEqual(["Día $1.899 ▼", "Día $1.899 ▼"]);
    expect(compare.asked).toEqual([EAN_DOVE, EAN_TRES]);
  });

  it("si la tarjeta cambia de producto, no queda el bloque del anterior", async () => {
    const compare = fakeCompare();
    const { doc, send } = setup("/carrito", undefined, { compare });
    send({ type: "cart", analysis: withEan(), seq: 1 });
    await tick();
    await compare.resolve(EAN_DOVE, RES);
    expect(bests(doc)).toEqual(["Día $1.899 ▼"]);
    const next = withEan();
    next.lines = next.lines.map((l) => (l.id === "prod00299912" ? { ...l, ean: null, cmp: null } : l));
    send({ type: "cart", analysis: next, seq: 2 });
    expect(doc.querySelector(".coto-unit-cmp")).toBeNull();
  });
});
