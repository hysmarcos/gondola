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
  win.MutationObserver = opts.MutationObserver ?? window.MutationObserver;
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

  it("caja: subtotal, descuentos de Coto, reintegro con tope, total final y mejor día", async () => {
    const { doc, send } = setup();
    send({ type: "settings", selected: [], day: 1 });
    const a = analyzeCart(CART_LINES, pick("456", "449"), 1, "200");
    send({ type: "cart", analysis: a, seq: 2 });
    await tick();
    const box = doc.querySelector(".coto-unit-cart-box");
    expect(box.previousElementSibling.classList.contains("card-body-container")).toBe(true);
    const kinds = [...box.children].map((e) => e.className.match(/--(\w+)/)[1]);
    expect(kinds[0]).toBe("subtotal");
    expect(kinds).toContain("group");
    expect(kinds).toContain("detail");
    expect(kinds.slice(-4)).toEqual(["bank", "cap", "total", "hint"]);
    const text = (k) => box.querySelector(`.coto-unit-sum-row--${k}`).textContent;
    expect(text("subtotal")).toContain("Subtotal");
    expect(text("bank")).toContain("Reintegro ICBC");
    expect(text("total")).toContain("Total final con reintegro");
    expect(text("hint")).toContain("Mejor día: martes con Credicoop");
  });

  it("tope semanal: lo dice en la línea del tope y no duplica la caja", async () => {
    const { doc, send } = setup();
    send({ type: "settings", selected: [], day: 2 });
    send({ type: "cart", analysis: analyzeCart(CART_LINES, pick("473"), 2, "200"), seq: 3 });
    send({ type: "cart", analysis: analyzeCart(CART_LINES, pick("473"), 2, "200"), seq: 4 });
    await tick();
    expect(doc.querySelectorAll(".coto-unit-cart-box")).toHaveLength(1);
    expect(doc.querySelector(".coto-unit-sum-row--cap").textContent).toMatch(/tope semanal/);
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

  it("línea: precio de Coto tachado, precio con promo y la promo; totales en detalle", async () => {
    const { doc, send, open } = setupMini();
    open();
    send({ type: "settings", selected: [], day: 1 });
    send({ type: "cart", analysis: analyzeCart(CART_LINES, pick("457"), 1, "200"), seq: 1 });
    await tick();
    const dove = [...doc.querySelectorAll("card-product-float")].find((c) => c.textContent.includes("DOVE"));
    expect(dove.querySelector(".coto-unit-mini-final").textContent).toBe("$5.478,24");
    expect(dove.querySelector(".coto-unit-sum-tag").textContent).toBe("3x2");
    expect(dove.querySelector(".precio-final").hasAttribute("data-coto-unit-strike")).toBe(true);
    // El total de Coto queda como Subtotal de nuestro detalle.
    const totalEl = doc.querySelector(".total-precio");
    expect(totalEl.hasAttribute("data-coto-unit-hide")).toBe(true);
    const box = doc.querySelector(".coto-unit-mini-total");
    expect(box.previousElementSibling).toBe(totalEl);
    expect(box.querySelector(".coto-unit-sum-row--subtotal").textContent).toContain("Subtotal");
    expect(box.querySelector(".coto-unit-sum-row--total")).not.toBeNull();
  });

  it("línea que aplica al banco: muestra lo que queda con el reintegro", async () => {
    const { doc, send, open } = setupMini();
    open();
    send({ type: "settings", selected: [], day: 1 });
    send({ type: "cart", analysis: analyzeCart(CART_LINES, pick("457"), 1, "200"), seq: 1 });
    await tick();
    const bolsa = [...doc.querySelectorAll("card-product-float")].find((c) => c.textContent.includes("Bolsa"));
    expect(bolsa.querySelector(".coto-unit-mini-bank").textContent).toMatch(/con reintegro$/);
    expect(bolsa.querySelector(".precio-final").hasAttribute("data-coto-unit-strike")).toBe(false);
  });

  it("si el total no coincide, no muestra nada", async () => {
    const { doc, send, open } = setupMini("$50.000,00");
    open();
    send({ type: "cart", analysis: analyzeCart(CART_LINES, [], 1, "200"), seq: 1 });
    await tick();
    expect(doc.querySelector(".coto-unit-mini-line, .coto-unit-mini-total")).toBeNull();
    expect(doc.querySelector(".total-precio").hasAttribute("data-coto-unit-hide")).toBe(false);
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
    // Como el cliente real: un lote entero se resuelve de una vez.
    async resolveAll(eans, res) {
      for (const e of eans) done.set(e, res);
      for (const e of eans) waiting.get(e)?.(res);
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
    expect(bests(doc)).toEqual(["Día $1.899 ▼ (x2)"]);
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
    expect(bests(doc)).toEqual(["Día $1.899 ▼ (x2)", "…"]);
    send({ type: "settings", selected: [], day: 1, compareStores: false });
    expect(doc.querySelector(".coto-unit-cmp")).toBeNull();
    await compare.resolve(EAN_TRES, RES);
    expect(doc.querySelector(".coto-unit-cmp")).toBeNull();
    // Al volver a encender se pinta con lo ya sabido, sin pedir de nuevo.
    send({ type: "settings", selected: [], day: 1, compareStores: true });
    expect(bests(doc)).toEqual(["Día $1.899 ▼ (x2)", "Día $1.899 ▼ (x2)"]);
    expect(compare.asked).toEqual([EAN_DOVE, EAN_TRES]);
  });

  it("si la tarjeta cambia de producto, no queda el bloque del anterior", async () => {
    const compare = fakeCompare();
    const { doc, send } = setup("/carrito", undefined, { compare });
    send({ type: "cart", analysis: withEan(), seq: 1 });
    await tick();
    await compare.resolve(EAN_DOVE, RES);
    expect(bests(doc)).toEqual(["Día $1.899 ▼ (x2)"]);
    const next = withEan();
    next.lines = next.lines.map((l) => (l.id === "prod00299912" ? { ...l, ean: null, cmp: null } : l));
    send({ type: "cart", analysis: next, seq: 2 });
    expect(doc.querySelector(".coto-unit-cmp")).toBeNull();
  });

  it("un lote de EAN que llega junto repinta una sola vez", async () => {
    class NoMO {
      observe() {}
      disconnect() {}
    }
    const compare = fakeCompare();
    const { doc, send } = setup("/carrito", undefined, { compare, MutationObserver: NoMO });
    // Tercera tarjeta con EAN propio, para que el lote sea de 3.
    const EAN_X = "7791293031259";
    doc.body.insertAdjacentHTML("afterbegin", `<card-product><div class="c__item-detail"><a class="title">Otro producto</a></div></card-product>`);
    const a = withEan(true);
    a.lines = [...a.lines, { ...a.lines[0], id: "x", name: "Otro producto", missing: 0, ean: EAN_X, cmp: CMP }];
    send({ type: "cart", analysis: a, seq: 1 });
    await tick();
    expect(compare.asked).toEqual([EAN_X, EAN_DOVE, EAN_TRES]);
    let passes = 0;
    const qsa = doc.querySelectorAll.bind(doc);
    doc.querySelectorAll = (sel) => {
      if (sel === "card-product") passes++;
      return qsa(sel);
    };
    await compare.resolveAll([EAN_X, EAN_DOVE, EAN_TRES], RES);
    expect(passes).toBe(1);
    expect(bests(doc)).toEqual(Array(3).fill("Día $1.899 ▼ (x2)"));
  });

  it("apagar o limpiar solo borra el bloque del carrito, no el de una caja de precio", async () => {
    const compare = fakeCompare();
    const { doc, send } = setup("/carrito", undefined, { compare });
    // Bloque de badge.js: va dentro de .coto-unit-box, nunca es hijo directo del detalle.
    const card = doc.querySelector("card-product");
    card.insertAdjacentHTML("beforeend", `<div class="coto-unit-box"><div class="coto-unit-cmp" id="ajeno"></div></div>`);
    send({ type: "cart", analysis: withEan(), seq: 1 });
    await tick();
    await compare.resolve(EAN_DOVE, RES);
    expect(doc.querySelectorAll(".c__item-detail > .coto-unit-cmp")).toHaveLength(1);
    send({ type: "settings", selected: [], day: 1, compareStores: false });
    expect(doc.querySelector(".c__item-detail > .coto-unit-cmp")).toBeNull();
    expect(doc.getElementById("ajeno")).not.toBeNull();
    send({ type: "settings", selected: [], day: 1, compareStores: true });
    await tick();
    expect(doc.querySelectorAll(".c__item-detail > .coto-unit-cmp")).toHaveLength(1);
    // Total que no coincide: clear() borra lo del carrito y deja lo ajeno.
    doc.querySelector(".card-body-container").firstChild.textContent = "Total: $1,00 ";
    send({ type: "cart", analysis: withEan(), seq: 2 });
    await tick();
    expect(doc.querySelector(".c__item-detail > .coto-unit-cmp")).toBeNull();
    expect(doc.getElementById("ajeno")).not.toBeNull();
  });

  it("aviso de promo y comparación en la misma tarjeta: se asienta y no vuelve a tocar el DOM", async () => {
    const compare = fakeCompare();
    const { doc, send } = setup("/carrito", "$51.094,91", { compare });
    const analysis = () => {
      const a = analyzeCart(dove4, [], today, "200");
      a.lines = a.lines.map((l) => (l.id === "prod00299912" ? { ...l, ean: EAN_DOVE, cmp: CMP } : l));
      return a;
    };
    let seq = 1;
    send({ type: "cart", analysis: analysis(), seq: seq++ });
    await tick();
    await compare.resolve(EAN_DOVE, RES);
    for (let i = 0; i < 3; i++) {
      send({ type: "cart", analysis: analysis(), seq: seq++ });
      await tick();
    }
    const detail = doc.querySelector(".coto-unit-cart-warn").parentElement;
    expect(detail.querySelector(":scope > .coto-unit-cmp")).not.toBeNull();
    const order = () => [...detail.children].map((c) => c.className);
    const before = order();
    const records = [];
    const mo = new MutationObserver((r) => records.push(...r));
    mo.observe(doc.body, { childList: true, subtree: true, attributes: true, characterData: true });
    send({ type: "cart", analysis: analysis(), seq: seq++ });
    await tick();
    send({ type: "cart", analysis: analysis(), seq: seq++ });
    await tick();
    mo.disconnect();
    expect(records).toHaveLength(0);
    expect(order()).toEqual(before);
    expect(order()).toEqual(["title", "coto-unit-cart-warn", "coto-unit-cmp"]);
  });
});

describe("v7: logos en el carrito", () => {
  it("las líneas con banco llevan su logo", async () => {
    const { doc, send } = setup("/carrito", "$48.355,92", { logoUrl: (n) => (n ? "https://x/" + n : null) });
    send({ type: "settings", selected: [], day: 1 });
    send({ type: "cart", analysis: analyzeCart(CART_LINES, pick("456", "449"), 1, "200"), seq: 2 });
    await tick();
    const imgs = [...doc.querySelectorAll(".coto-unit-cart-box img.coto-unit-logo")];
    expect(imgs.length).toBeGreaterThan(0);
    expect(imgs[0].getAttribute("src")).toMatch(/^https:\/\/x\/logo_/);
    expect(imgs[0].getAttribute("alt")).toBeTruthy();
    expect(doc.querySelector(".coto-unit-cart-box").textContent).toContain("Subtotal");
  });
});
