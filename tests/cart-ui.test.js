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

function setup(path = "/carrito", total = "$48.355,92") {
  const win = new EventTarget();
  win.location = { pathname: path };
  win.MutationObserver = window.MutationObserver;
  const doc = document.implementation.createHTMLDocument("cart");
  const line = (name) => `<card-product><div class="c__item-detail"><a class="title">  ${name} </a></div><input value="1"></card-product>`;
  doc.body.innerHTML = `
    ${line("JABÓN DE TOCADOR DOVE KARITE  Y VAINILLA 90 G")}
    ${line("Shampoo TRESEMME Keratina Antifrizz 500 Ml")}
    <div class="card-body text-center card-body-container">Total: ${total} <button>Continuar compra</button></div>`;
  installCartUi(win, doc);
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
      `${when} con ICBC: $29.963 (reintegro $7.491)`,
      "Mejor día: martes con Credicoop, $26.218",
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
