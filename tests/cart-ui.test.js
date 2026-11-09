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

function setup(path = "/carrito", total = "$48.355,92", deps) {
  const win = new EventTarget();
  win.location = { pathname: path };
  win.MutationObserver = window.MutationObserver;
  const doc = document.implementation.createHTMLDocument("cart");
  const line = (name) => `<card-product><div class="c__item-detail"><a class="title">  ${name} </a></div><input value="1"></card-product>`;
  doc.body.innerHTML = `
    ${line("JABÓN DE TOCADOR DOVE KARITE  Y VAINILLA 90 G")}
    ${line("Shampoo TRESEMME Keratina Antifrizz 500 Ml")}
    <div class="card-body text-center card-body-container">Total: ${total} <button>Continuar compra</button></div>`;
  installCartUi(win, doc, deps);
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
    expect(doc.querySelector(".coto-unit-cart-box").textContent).toContain("Total con promos de Coto");
  });
});
