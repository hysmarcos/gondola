// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createCompareClient } from "../src/compare-client.js";
import { installCartUi } from "../src/cart-ui.js";
import { analyzeCart } from "../src/cart.js";
import { compareCart } from "../src/cart-compare.js";

// La cuenta de verdad, espiada: se ve cuántas veces se rehace.
vi.mock("../src/cart-compare.js", async (orig) => {
  const m = await orig();
  return { ...m, compareCart: vi.fn(m.compareCart) };
});
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
    expect(dove.querySelector(".coto-unit-mini-final").textContent).toBe("$5.477,98");
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

  it("si cambia la lista de súper se vuelve a pedir con la lista nueva (cliente real)", async () => {
    const send = vi.fn(async (eans, list) => Object.fromEntries(eans.map((e) => [e, Object.fromEntries(list.map((id) => [id, "missing"]))])));
    const compare = createCompareClient({ send, waitForStores: true, delayMs: 0, setTimer: (fn) => queueMicrotask(fn) });
    const { send: post } = setup("/carrito", undefined, { compare });
    post({ type: "settings", selected: [], day: 1, stores: ["carrefour"] });
    post({ type: "cart", analysis: withEan(), seq: 1 });
    await tick();
    await tick();
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][1]).toEqual(["carrefour"]);
    post({ type: "settings", selected: [], day: 1, stores: ["carrefour", "mas"] });
    await tick();
    await tick();
    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls[1][1]).toEqual(["carrefour", "mas"]);
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
    expect(order()).toEqual(["title", "coto-unit-mini-line coto-unit-cart-line", "coto-unit-cart-warn", "coto-unit-cmp"]);
  });
});

describe("carrito comparado", () => {
  // Pedidos falsos: se guardan y se resuelven a mano.
  function fakeDeps() {
    const calls = [];
    const promoCalls = [];
    return {
      calls,
      promoCalls,
      cartCompare: (items, stores) => new Promise((resolve) => calls.push({ items, stores, resolve })),
      bankPromos: (stores) => new Promise((resolve) => promoCalls.push({ stores, resolve })),
    };
  }
  const lineRes = (total) => ({ [EAN_DOVE]: { total, onSale: false, url: "https://diaonline.supermercadosdia.com.ar/dove/p" } });
  const answer = (stores, total = 5000) => Object.fromEntries(stores.map((id) => [id, { at: Date.now(), lines: lineRes(total) }]));
  const qty = (n) => {
    const a = withEan();
    a.lines = a.lines.map((l) => (l.ean === EAN_DOVE ? { ...l, qty: n } : l));
    return a;
  };
  const cc = (doc) => doc.querySelector(".coto-unit-cc");
  const storeBlock = (doc, id) => doc.querySelector(`.coto-unit-cc [data-store="${id}"]`);

  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("dos carritos seguidos: un solo pedido, 800 ms después del último", async () => {
    const deps = fakeDeps();
    const { send } = setup("/carrito", undefined, deps);
    send({ type: "settings", selected: [], day: 1, stores: ["dia", "mas"] });
    send({ type: "cart", analysis: qty(1), seq: 1 });
    await vi.advanceTimersByTimeAsync(500);
    send({ type: "cart", analysis: qty(2), seq: 2 });
    await vi.advanceTimersByTimeAsync(799);
    expect(deps.calls).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(1);
    expect(deps.calls).toHaveLength(1);
    expect(deps.calls[0].items).toEqual([{ ean: EAN_DOVE, qty: 2 }]);
    expect(deps.calls[0].stores).toEqual(["dia", "mas"]);
    // Sin tarjetas no se piden promos.
    expect(deps.promoCalls).toHaveLength(0);
  });

  it("pinta el bloque después de la caja de resumen, con los súper prendidos", async () => {
    const deps = fakeDeps();
    const { doc, send } = setup("/carrito", undefined, deps);
    send({ type: "settings", selected: [], day: 1, stores: ["dia", "mas"] });
    send({ type: "cart", analysis: withEan(), seq: 1 });
    await vi.advanceTimersByTimeAsync(800);
    deps.calls[0].resolve(answer(["dia", "mas"]));
    await vi.advanceTimersByTimeAsync(0);
    expect(cc(doc).previousElementSibling.classList.contains("coto-unit-cart-box")).toBe(true);
    expect(cc(doc).textContent).toContain("Tu carrito en otros súper");
    expect(storeBlock(doc, "dia").querySelector(".coto-unit-cc-name").textContent).toBe("Día");
    expect(storeBlock(doc, "dia").querySelector(".coto-unit-cc-count").textContent).toBe("1 de 6 productos");
    expect(storeBlock(doc, "carrefour")).toBeNull();
  });

  it("con tarjetas pide las promos y pinta el renglón con tarjetas", async () => {
    const deps = fakeDeps();
    const { doc, send } = setup("/carrito", undefined, deps);
    send({ type: "settings", selected: [], day: 1, stores: ["dia"], cards: { naranjax: { plan: null } } });
    send({ type: "cart", analysis: withEan(), seq: 1 });
    await vi.advanceTimersByTimeAsync(800);
    expect(deps.promoCalls.map((c) => c.stores)).toEqual([["dia"]]);
    deps.calls[0].resolve(answer(["dia"]));
    deps.promoCalls[0].resolve(null);
    await vi.advanceTimersByTimeAsync(0);
    expect(storeBlock(doc, "dia").textContent).toContain("No pudimos leer las promos");
  });

  it("la respuesta de un carrito viejo no se pinta", async () => {
    const deps = fakeDeps();
    const { doc, send } = setup("/carrito", undefined, deps);
    send({ type: "settings", selected: [], day: 1, stores: ["dia"] });
    send({ type: "cart", analysis: qty(1), seq: 1 });
    await vi.advanceTimersByTimeAsync(800);
    send({ type: "cart", analysis: qty(2), seq: 2 });
    deps.calls[0].resolve(answer(["dia"]));
    await vi.advanceTimersByTimeAsync(0);
    expect(cc(doc)).toBeNull();
    await vi.advanceTimersByTimeAsync(800);
    expect(deps.calls).toHaveLength(2);
    deps.calls[1].resolve(answer(["dia"], 9000));
    await vi.advanceTimersByTimeAsync(0);
    expect(storeBlock(doc, "dia")).not.toBeNull();
  });

  it("stores: [] no pide ni pinta", async () => {
    const deps = fakeDeps();
    const { doc, send } = setup("/carrito", undefined, deps);
    send({ type: "settings", selected: [], day: 1, stores: [] });
    send({ type: "cart", analysis: withEan(), seq: 1 });
    await vi.advanceTimersByTimeAsync(2000);
    expect(deps.calls).toHaveLength(0);
    expect(cc(doc)).toBeNull();
  });

  it("carrito sin ninguna línea con EAN: no pide ni pinta", async () => {
    const deps = fakeDeps();
    const { doc, send } = setup("/carrito", undefined, deps);
    send({ type: "cart", analysis: analyzeCart(CART_LINES, [], today, "200"), seq: 1 });
    await vi.advanceTimersByTimeAsync(2000);
    expect(deps.calls).toHaveLength(0);
    expect(cc(doc)).toBeNull();
  });

  it("al sacar Día con una respuesta en vuelo, al llegar no hay bloque de Día", async () => {
    const deps = fakeDeps();
    const { doc, send } = setup("/carrito", undefined, deps);
    send({ type: "settings", selected: [], day: 1, stores: ["dia", "mas"] });
    send({ type: "cart", analysis: withEan(), seq: 1 });
    await vi.advanceTimersByTimeAsync(800);
    deps.calls[0].resolve(answer(["dia", "mas"]));
    await vi.advanceTimersByTimeAsync(0);
    expect(storeBlock(doc, "dia")).not.toBeNull();
    // "Actualizar" pide ya, sin esperar.
    [...cc(doc).querySelectorAll("button")].find((b) => b.textContent === "Actualizar").click();
    expect(deps.calls).toHaveLength(2);
    send({ type: "settings", selected: [], day: 1, stores: ["mas"] });
    expect(storeBlock(doc, "dia")).toBeNull();
    deps.calls[1].resolve(answer(["dia", "mas"]));
    await vi.advanceTimersByTimeAsync(0);
    expect(storeBlock(doc, "dia")).toBeNull();
    expect(storeBlock(doc, "mas")).not.toBeNull();
    await vi.advanceTimersByTimeAsync(800);
    expect(deps.calls[2].stores).toEqual(["mas"]);
    deps.calls[2].resolve(answer(["mas"]));
    await vi.advanceTimersByTimeAsync(0);
    expect(storeBlock(doc, "dia")).toBeNull();
  });

  it("compareStores apagado: se borra el bloque", async () => {
    const deps = fakeDeps();
    const { doc, send } = setup("/carrito", undefined, deps);
    send({ type: "settings", selected: [], day: 1, stores: ["dia"] });
    send({ type: "cart", analysis: withEan(), seq: 1 });
    await vi.advanceTimersByTimeAsync(800);
    deps.calls[0].resolve(answer(["dia"]));
    await vi.advanceTimersByTimeAsync(0);
    expect(cc(doc)).not.toBeNull();
    send({ type: "settings", selected: [], day: 1, stores: ["dia"], compareStores: false });
    expect(cc(doc)).toBeNull();
  });

  it("ningún nodo de Coto cambia de padre ni de atributos", async () => {
    const deps = fakeDeps();
    const { doc, send } = setup("/carrito", undefined, deps);
    const coto = [...doc.body.querySelectorAll("*")].map((el) => ({ el, parent: el.parentNode, attrs: [...el.attributes].map((a) => `${a.name}=${a.value}`).join() }));
    send({ type: "settings", selected: [], day: 1, stores: ["dia", "mas"] });
    send({ type: "cart", analysis: withEan(), seq: 1 });
    await vi.advanceTimersByTimeAsync(800);
    deps.calls[0].resolve(answer(["dia", "mas"]));
    await vi.advanceTimersByTimeAsync(0);
    expect(cc(doc)).not.toBeNull();
    for (const { el, parent, attrs } of coto) {
      expect(el.parentNode).toBe(parent);
      expect([...el.attributes].map((a) => `${a.name}=${a.value}`).join()).toBe(attrs);
    }
  });

  // Página de producto con el mini-carrito (abierto o cerrado).
  function setupMiniCc(deps, { open = true } = {}) {
    const win = new EventTarget();
    win.location = { pathname: "/productos/x" };
    win.postMessage = () => {};
    win.MutationObserver = window.MutationObserver;
    const doc = document.implementation.createHTMLDocument("mini");
    // Como Coto: el desplegable se arma al abrirse.
    const menu = `<ul class="dropdown-menu dropdown-carrito show"><div class="precio-carrito"><div class="total-precio"><h4 class="roar-total">$48.355,92</h4></div></div></ul>`;
    doc.body.innerHTML = "<header></header>";
    const setOpen = (on) => { doc.querySelector("header").innerHTML = on ? menu : ""; };
    setOpen(open);
    installCartUi(win, doc, deps);
    const send = (data) => win.dispatchEvent(new MessageEvent("message", { data: { source: "coto-unit", ...data } }));
    return { doc, send, setOpen };
  }
  // El súper compite: tiene más de la mitad del carrito en común.
  const competing = (n = 3) => {
    const a = qty(n);
    a.total = 5000;
    return a;
  };

  it("mini-carrito: la fila está desde el primer pintado y no se va entre cambios del carrito", async () => {
    const deps = fakeDeps();
    const { doc, send } = setupMiniCc(deps);
    send({ type: "settings", selected: [], day: 1, stores: ["dia"] });
    send({ type: "cart", analysis: competing(), seq: 1 });
    const box = doc.querySelector(".coto-unit-mini-total");
    const row = () => box.querySelector(".coto-unit-cc-mini");
    // Antes de cualquier respuesta: la fila ya ocupa su lugar.
    expect(row().textContent).toBe("Comparando con otros súper…");
    expect(box.lastElementChild).toBe(row());
    expect(row().classList.contains("coto-unit-sum-row")).toBe(true);
    expect(row().getAttribute("href")).toBe("/carrito");
    await vi.advanceTimersByTimeAsync(800);
    deps.calls[0].resolve(answer(["dia"], 4000));
    await vi.advanceTimersByTimeAsync(0);
    expect(row().textContent).toBe("Día: $1.478 menos en 1 de 6");
    // Cambia el carrito: la fila sigue, esperando la respuesta nueva.
    send({ type: "cart", analysis: competing(4), seq: 2 });
    expect(row().textContent).toBe("Comparando con otros súper…");
    await vi.advanceTimersByTimeAsync(800);
    // Sin súper que compita: la fila sigue, con su texto.
    deps.calls[1].resolve(answer(["dia"], 50000));
    await vi.advanceTimersByTimeAsync(0);
    expect(row().textContent).toBe("Pocos productos en común para comparar");
  });

  it("página de producto con el mini-carrito cerrado: no pide; al abrirlo, sí", async () => {
    const deps = fakeDeps();
    const { send, setOpen } = setupMiniCc(deps, { open: false });
    send({ type: "settings", selected: [], day: 1, stores: ["dia"] });
    send({ type: "cart", analysis: competing(), seq: 1 });
    await vi.advanceTimersByTimeAsync(2000);
    expect(deps.calls).toHaveLength(0);
    setOpen(true);
    await vi.advanceTimersByTimeAsync(800);
    expect(deps.calls).toHaveLength(1);
  });

  it("en /carrito con el total desfasado no pide", async () => {
    const deps = fakeDeps();
    const { send } = setup("/carrito", "$1,00", deps);
    send({ type: "settings", selected: [], day: 1, stores: ["dia"] });
    send({ type: "cart", analysis: withEan(), seq: 1 });
    await vi.advanceTimersByTimeAsync(2000);
    expect(deps.calls).toHaveLength(0);
  });

  it("las líneas sin precio comparable (pesables) no se mandan", async () => {
    const deps = fakeDeps();
    const { send } = setup("/carrito", undefined, deps);
    send({ type: "settings", selected: [], day: 1, stores: ["dia"] });
    const a = withEan();
    // Tresemme con EAN pero sin cmp, como un producto pesable.
    a.lines = a.lines.map((l) => (l.id === "prod00608118" ? { ...l, ean: EAN_TRES, cmp: null } : l));
    send({ type: "cart", analysis: a, seq: 1 });
    await vi.advanceTimersByTimeAsync(800);
    expect(deps.calls[0].items.map((i) => i.ean)).toEqual([EAN_DOVE]);
  });

  it("cerrar y volver a abrir el mini-carrito no vuelve a pedir el mismo carrito (hasta 5 min)", async () => {
    const deps = fakeDeps();
    const { send, setOpen } = setupMiniCc(deps);
    send({ type: "settings", selected: [], day: 1, stores: ["dia"] });
    send({ type: "cart", analysis: competing(), seq: 1 });
    await vi.advanceTimersByTimeAsync(800);
    deps.calls[0].resolve(answer(["dia"], 4000));
    await vi.advanceTimersByTimeAsync(0);
    setOpen(false);
    await vi.advanceTimersByTimeAsync(1000);
    setOpen(true);
    send({ type: "cart", analysis: competing(), seq: 2 });
    await vi.advanceTimersByTimeAsync(2000);
    expect(deps.calls).toHaveLength(1);
    // Más de 5 minutos después: se pide de nuevo.
    setOpen(false);
    await vi.advanceTimersByTimeAsync(5 * 60_000);
    setOpen(true);
    await vi.advanceTimersByTimeAsync(800);
    expect(deps.calls).toHaveLength(2);
  });

  it("en /carrito, un total desfasado un rato no hace pedir de nuevo", async () => {
    const deps = fakeDeps();
    const { doc, send } = setup("/carrito", undefined, deps);
    send({ type: "settings", selected: [], day: 1, stores: ["dia"] });
    send({ type: "cart", analysis: withEan(), seq: 1 });
    await vi.advanceTimersByTimeAsync(800);
    deps.calls[0].resolve(answer(["dia"]));
    await vi.advanceTimersByTimeAsync(0);
    const total = doc.querySelector(".card-body-container");
    const before = total.innerHTML;
    total.innerHTML = "Total: $1,00";
    await vi.advanceTimersByTimeAsync(100);
    total.innerHTML = before;
    await vi.advanceTimersByTimeAsync(2000);
    expect(deps.calls).toHaveLength(1);
    expect(cc(doc)).not.toBeNull();
    // "Actualizar" igual pide.
    [...cc(doc).querySelectorAll("button")].find((b) => b.textContent === "Actualizar").click();
    expect(deps.calls).toHaveLength(2);
  });

  it("los cambios del DOM no rehacen la cuenta si no cambió nada", async () => {
    const deps = fakeDeps();
    const { doc, send } = setup("/carrito", undefined, deps);
    send({ type: "settings", selected: [], day: 1, stores: ["dia"] });
    send({ type: "cart", analysis: withEan(), seq: 1 });
    await vi.advanceTimersByTimeAsync(800);
    deps.calls[0].resolve(answer(["dia"]));
    await vi.advanceTimersByTimeAsync(0);
    compareCart.mockClear();
    for (let i = 0; i < 3; i++) {
      doc.body.append(doc.createElement("span"));
      await vi.advanceTimersByTimeAsync(0);
    }
    expect(compareCart).not.toHaveBeenCalled();
    // Otro día de compra: se rehace una vez.
    send({ type: "settings", selected: [], day: 2, stores: ["dia"] });
    expect(compareCart).toHaveBeenCalledTimes(1);
  });

  it("con las promos de tarjetas sin llegar, compara sin tarjetas", async () => {
    const deps = fakeDeps();
    const { doc, send } = setup("/carrito", undefined, deps);
    send({ type: "settings", selected: [], day: 1, stores: ["dia"] });
    const a = withEan();
    a.total = 5000;
    send({ type: "cart", analysis: a, seq: 1 });
    await vi.advanceTimersByTimeAsync(800);
    deps.calls[0].resolve(answer(["dia"], 4000));
    await vi.advanceTimersByTimeAsync(0);
    expect(cc(doc).textContent).toContain("Pagás $1.478 menos");
    // Se prenden tarjetas: hasta que lleguen sus promos, ni la respuesta ni los súper usan banco.
    send({ type: "settings", selected: [], day: 1, stores: ["dia"], cards: { naranjax: { plan: null } } });
    expect(cc(doc).textContent).toContain("Pagás $1.478 menos");
    expect(cc(doc).textContent).not.toContain("Con tus tarjetas");
    expect(cc(doc).textContent).not.toContain("Tus tarjetas");
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

describe("resumen nutricional del carrito", () => {
  const food = { kcal: 350, sugars: 2, sodiumMg: 5 };
  const analysis = () => {
    const a = analyzeCart(CART_LINES, [], 1, "200");
    // Dos líneas de comida: 2 × 500 g y una sin tabla.
    a.lines = [
      { ...a.lines[0], ean: "1", nutri: true, qty: 2, amount: 0.5 },
      { ...a.lines[1], ean: "2", nutri: true, qty: 1, amount: 0.4 },
    ];
    return a;
  };

  it("pide la tabla de cada producto de comida y suma la compra en la caja", async () => {
    const asked = [];
    const nutrition = { request: async (ean) => (asked.push(ean), ean === "1" ? { per100: food } : "missing") };
    const { doc, send } = setup("/carrito", "$48.355,92", { nutrition });
    send({ type: "settings", selected: [], day: 1 });
    send({ type: "cart", analysis: analysis(), seq: 1 });
    await tick(); await tick(); await tick();
    expect(asked.sort()).toEqual(["1", "2"]);
    const box = doc.querySelector(".coto-unit-cart-box");
    expect(box.textContent).toContain("Tu compra: 3.500 kcal · 20 g de azúcares · 0,1 g de sodio");
    expect(box.textContent).toContain("1 de 2 productos sin datos nutricionales");
  });

  it("con la información nutricional apagada no pide ni muestra", async () => {
    const asked = [];
    const nutrition = { request: async (ean) => (asked.push(ean), { per100: food }) };
    const { doc, send } = setup("/carrito", "$48.355,92", { nutrition });
    send({ type: "settings", selected: [], day: 1, nutrition: false });
    send({ type: "cart", analysis: analysis(), seq: 1 });
    await tick(); await tick();
    expect(asked).toEqual([]);
    expect(doc.querySelector(".coto-unit-cart-box").textContent).not.toContain("Tu compra");
  });
});
