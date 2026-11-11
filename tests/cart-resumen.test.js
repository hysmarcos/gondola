// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { installCartUi, discountRows } from "../src/cart-ui.js";
import { summaryRows, paintSummary } from "../src/cart-summary.js";
import { analyzeCart } from "../src/cart.js";

const tick = () => new Promise((r) => setTimeout(r, 0));
const prod = (name, list, discounts = [], extra = {}) => ({
  url: name, sku_display_name: name, product_format: "Litro", product_format_quantity: 1,
  price: [{ store: "200", listPrice: list, formatPrice: list }], discounts, ...extra,
});
const line = (id, name, qty, list, data) => ({ id, name, qty, list, data });
const icbc = (cap) => ({ id: "1", bank: "ICBC", logo: "logo_icbc_1.png", days: [1], percent: 30, cap, capWeekly: true, onlyNoOffer: true });
const comunidad = { id: "9", bank: "Comunidad Coto", logo: "logo_comunidad.png", days: [1], percent: 20, cap: null, capWeekly: false };

const shampoo = line("a", "Shampoo TRESEMME", 1, 11882.99, prod("Shampoo TRESEMME", 11882.99, [{ discountText: "40%Dto", takingText: null, discountPrice: "$7128.61" }]));
const limpiador = line("c", "Limpiador Heroe", 1, 5750.99, prod("Limpiador Heroe", 5750.99));
const papas = line("d", "Papas Bem Brasil", 1, 9499, prod("Papas Bem Brasil", 9499));

describe("resumen del carrito: el detalle empieza cerrado", () => {
  const paint = (a, opts) => {
    const box = document.createElement("div");
    document.body.replaceChildren(box);
    paintSummary(document, box, summaryRows(a, 1, 1, opts));
    return box;
  };
  const visible = (box) => [...box.children].filter((r) => !r.hidden).map((r) => r.querySelector(".coto-unit-sum-name")?.textContent ?? r.textContent);

  it("muestra una línea por descuento y esconde el detalle", () => {
    const box = paint(analyzeCart([shampoo, limpiador, papas], [icbc(null)], 1, "200"));
    expect(visible(box)).toEqual(["Subtotal", "Descuentos Coto", "Reintegro ICBC 30%", "Total final con reintegro"]);
    const group = box.querySelector('[data-group="coto"]');
    expect(group.tagName).toBe("BUTTON");
    expect(group.getAttribute("aria-expanded")).toBe("false");
    // El detalle sigue en la página, cerrado.
    expect(box.querySelector('[data-of="coto"]').hidden).toBe(true);
    expect(box.querySelector('[data-of="bank"]').textContent).toBe("Sin tope de reintegro");
  });

  it("al tocar 'Descuentos Coto' abre el detalle, y al tocar de nuevo lo cierra", () => {
    const box = paint(analyzeCart([shampoo, limpiador], [], 1, "200"));
    const group = box.querySelector('[data-group="coto"]');
    group.click();
    expect(group.getAttribute("aria-expanded")).toBe("true");
    expect(visible(box)).toEqual(["Subtotal", "Descuentos Coto", "Shampoo TRESEMME", "Total final"]);
    expect(box.querySelector('[data-of="coto"] .coto-unit-sum-tag').textContent).toBe("40% dto");
    group.click();
    expect(visible(box)).toEqual(["Subtotal", "Descuentos Coto", "Total final"]);
  });

  it("lo abierto sigue abierto cuando el carrito cambia", () => {
    const box = paint(analyzeCart([shampoo, limpiador], [], 1, "200"));
    box.querySelector('[data-group="coto"]').click();
    paintSummary(document, box, summaryRows(analyzeCart([shampoo, limpiador, papas], [], 1, "200"), 1, 1));
    expect(box.querySelector('[data-group="coto"]').getAttribute("aria-expanded")).toBe("true");
    expect(box.querySelector('[data-of="coto"]').hidden).toBe(false);
  });

  it("el clic no sale de la caja: el desplegable de Coto no se cierra", () => {
    const box = paint(analyzeCart([shampoo, limpiador], [], 1, "200"));
    let outside = 0;
    document.body.addEventListener("click", () => outside++);
    box.querySelector('[data-group="coto"]').click();
    expect(outside).toBe(0);
  });

  it("Comunidad: 'Descuento Comunidad Coto', con su detalle cerrado", () => {
    const box = paint(analyzeCart([limpiador, papas], [comunidad], 1, "200"));
    expect(visible(box)).toEqual(["Subtotal", "Descuento Comunidad Coto 20%", "Total final"]);
    box.querySelector('[data-group="bank"]').click();
    expect(visible(box)).toContain("Sin tope de descuento");
  });

  it("si llegaste al tope, ese aviso queda siempre a la vista", () => {
    const box = paint(analyzeCart([limpiador, papas], [icbc(1000)], 1, "200"));
    expect(visible(box).some((t) => /Llegaste al tope/.test(t))).toBe(true);
    expect(box.querySelector('[data-group="bank"]')).toBeNull();
  });

  it("sin descuentos no hay nada para abrir", () => {
    const box = paint(analyzeCart([limpiador], [], 1, "200"));
    expect(box.querySelector("button")).toBeNull();
    expect(visible(box)).toEqual(["Subtotal", "Total final"]);
  });
});

describe("descuentos de una línea", () => {
  it("promo de Coto: lista, promo y lo que se paga", () => {
    const [l] = analyzeCart([shampoo], [], 1, "200").lines;
    expect(discountRows(l, null)).toEqual([
      { label: "Precio de lista", value: "$11.882,99" },
      { label: "Promo de Coto: 40% dto", value: "−$4.754,38" },
      { label: "Pagás", value: "$7.128,61", total: true },
    ]);
  });

  it("reintegro del banco: dice en cuánto queda", () => {
    const a = analyzeCart([limpiador, papas], [icbc(null)], 1, "200");
    const rows = discountRows(a.lines[0], a.today.promo);
    expect(rows.map((r) => r.label)).toEqual(["Precio de lista", "Reintegro ICBC 30%", "Te queda en"]);
    expect(rows[1].value).toBe("−$1.725,30");
  });

  it("Comunidad es un descuento, no un reintegro; con cantidad dice las unidades", () => {
    const a = analyzeCart([{ ...papas, qty: 2 }], [comunidad], 1, "200");
    const rows = discountRows(a.lines[0], a.today.promo);
    expect(rows.map((r) => r.label)).toEqual(["Precio de lista (2 u.)", "Descuento Comunidad Coto 20%", "Pagás"]);
  });

  it("sin descuentos no hay filas", () => {
    const [l] = analyzeCart([limpiador], [], 1, "200").lines;
    expect(discountRows(l, null)).toEqual([]);
  });
});

describe("la línea de cada producto, igual en el mini-carrito y en /carrito", () => {
  const today = new Date().getDay();
  function setup(path, html) {
    const win = new EventTarget();
    win.location = { pathname: path };
    win.postMessage = () => {};
    win.MutationObserver = window.MutationObserver;
    win.innerHeight = 800;
    const doc = document.implementation.createHTMLDocument("c");
    doc.body.innerHTML = html;
    installCartUi(win, doc);
    const send = (data) => win.dispatchEvent(new MessageEvent("message", { data: { source: "coto-unit", ...data } }));
    return { doc, send };
  }
  const analysis = analyzeCart([shampoo, limpiador], [], today, "200");
  const cartHtml = `
    <card-product><div class="c__item-detail"><a class="title">Shampoo TRESEMME</a></div></card-product>
    <card-product><div class="c__item-detail"><a class="title">Limpiador Heroe</a></div></card-product>
    <div class="card-body-container">Total: $17.633,98</div>`;
  const miniHtml = `<ul class="dropdown-carrito show"><card-product-float>
      <p class="titulo-producto">Shampoo TRESEMME</p><p class="precio"><span class="precio-final">$11.882,99</span></p></card-product-float>
    <div class="total-precio"><h4 class="roar-total">$17.633,98</h4></div></ul>`;

  it("/carrito: lista tachada, precio con promo y etiqueta; solo en el producto con descuento", async () => {
    const { doc, send } = setup("/carrito", cartHtml);
    send({ type: "cart", analysis, seq: 1 });
    await tick();
    const lines = doc.querySelectorAll(".coto-unit-cart-line");
    expect(lines).toHaveLength(1);
    const el = lines[0];
    expect(el.closest("card-product").textContent).toContain("Shampoo");
    expect(el.querySelector("s").textContent).toBe("$11.882,99");
    expect(el.querySelector(".coto-unit-mini-final").textContent).toBe("$7.128,61");
    expect(el.querySelector(".coto-unit-sum-tag").textContent).toBe("40% dto");
    // No toca los nodos de Coto.
    expect(doc.querySelector("a.title").textContent).toBe("Shampoo TRESEMME");
  });

  it("mini-carrito: la misma línea, sin repetir el precio de lista que ya muestra Coto", async () => {
    const { doc, send } = setup("/productos/x", miniHtml);
    send({ type: "cart", analysis, seq: 1 });
    await tick();
    const el = doc.querySelector(".coto-unit-mini-line");
    expect(el.classList.contains("coto-unit-cart-line")).toBe(false);
    expect(el.querySelector("s")).toBeNull();
    expect(el.querySelector(".coto-unit-mini-final").textContent).toBe("$7.128,61");
    expect(el.querySelector(".coto-unit-sum-tag").textContent).toBe("40% dto");
  });

  it("al pasar el mouse o llegar con el teclado, un globo detalla los descuentos", async () => {
    const { doc, send } = setup("/productos/x", miniHtml);
    send({ type: "cart", analysis, seq: 1 });
    await tick();
    const el = doc.querySelector(".coto-unit-mini-line");
    expect(el.tabIndex).toBe(0);
    expect(el.getAttribute("aria-label")).toBe("Precio de lista: $11.882,99. Promo de Coto: 40% dto: −$4.754,38. Pagás: $7.128,61");
    expect(doc.querySelector(".coto-unit-tip")).toBeNull();
    el.dispatchEvent(new MouseEvent("mouseenter"));
    const tip = doc.querySelector(".coto-unit-tip");
    expect(tip.getAttribute("role")).toBe("tooltip");
    expect(tip.hidden).toBe(false);
    expect([...tip.children].map((r) => r.textContent)).toEqual(["Precio de lista$11.882,99", "Promo de Coto: 40% dto−$4.754,38", "Pagás$7.128,61"]);
    el.dispatchEvent(new MouseEvent("mouseleave"));
    expect(tip.hidden).toBe(true);
    el.dispatchEvent(new FocusEvent("focus"));
    expect(tip.hidden).toBe(false);
    doc.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(tip.hidden).toBe(true);
    // Un solo globo para toda la página.
    expect(doc.querySelectorAll(".coto-unit-tip")).toHaveLength(1);
  });

  it("si el producto pierde el descuento, la línea se va", async () => {
    const { doc, send } = setup("/carrito", cartHtml);
    send({ type: "cart", analysis, seq: 1 });
    await tick();
    const plain = analyzeCart([{ ...shampoo, data: prod("Shampoo TRESEMME", 11882.99) }, limpiador], [], today, "200");
    send({ type: "cart", analysis: plain, seq: 2 });
    await tick();
    expect(doc.querySelector(".coto-unit-cart-line")).toBeNull();
  });
});
