// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { installBadges, formatValue, formatNote, formatBank, formatBlocked, groupMark } from "../src/badge.js";

const K = (n) => `_/R-0000000${n}-0000000${n}-200`;
const offerCard = (key, name = "Ravioles") => `
  <div class="producto-card"><div class="card-container">
    <a href="/productos/x/${key}">foto</a>
    <div class="centro-precios"><h3 class="nombre-producto">${name}</h3>
      <div class="descuentos-slot"><small class="offer-crum">PRECIO CON 25%DTO</small><h4 class="card-title">$2.588,72</h4></div>
      <div><small class="card-text">Precio Regular: $3.459,00</small><small>Precio sin impuestos nacionales: $2.858,68</small></div>
      <div><small class="card-text">Precio por 1 Kilo: $6.918,00</small></div>
      <div class="bottom-botones"><button>Agregar</button></div>
    </div></div></div>`;
const plainCard = (key) => `
  <div class="producto-card"><div class="card-container">
    <a href="/productos/x/${key}"></a>
    <div class="centro-precios"><h3 class="nombre-producto">Ravioles</h3><h4 class="card-title">$4.550,00</h4>
      <div class="bottom-botones"><button>Agregar</button></div></div></div></div>`;

const L = (value, extra = {}) => ({ group: "kg", value, drained: false, take: 1, note: null, bankValue: null, bankName: null, bankBlocked: null, ...extra });
const tick = () => new Promise((r) => setTimeout(r, 0));

function setup(html, path = "/productos/categorias/x", opts) {
  const win = new EventTarget();
  win.location = { pathname: path };
  win.posted = [];
  win.postMessage = (m) => win.posted.push(m);
  win.MutationObserver = window.MutationObserver;
  const doc = document.implementation.createHTMLDocument("x");
  doc.body.innerHTML = html;
  if (opts?.IntersectionObserver) win.IntersectionObserver = opts.IntersectionObserver;
  installBadges(win, doc, opts);
  const send = (data) => win.dispatchEvent(new MessageEvent("message", { data: { source: "coto-unit", ...data } }));
  return { win, doc, send };
}

describe("textos", () => {
  it("valor, nota, banco y bloqueo", () => {
    expect(formatValue(L(5177.4))).toBe("$5.177 /kg");
    expect(formatValue(L(206.35, { group: "rollo10m" }))).toBe("$206 /10 m");
    expect(formatValue(L(555.55, { group: "panos100" }))).toBe("$556 /100 paños");
    expect(formatValue(L(396.17, { group: "m2" }))).toBe("$396 /m²");
    expect(formatValue(L(null, { group: "sin_dato" }))).toBeNull();
    expect(formatNote(L(1, { take: 3, drained: true, note: "doble hoja" }))).toBe("llevando 3 · escurrido · doble hoja");
    expect(formatNote(L(1))).toBeNull();
    expect(formatBank(L(1, { bankValue: 3624.2, bankName: "ICBC" }), 1, 1)).toBe("Hoy con ICBC: $3.624/kg");
    expect(formatBank(L(1, { bankValue: 3624.2, bankName: "ICBC" }), 2, 1)).toBe("Martes con ICBC: $3.624/kg");
    expect(formatBlocked("oferta")).toBe("Banco no aplica: ya está en oferta");
    expect(formatBlocked("excluido")).toBe("Banco no aplica: excluido de promos");
    expect(formatBlocked(null)).toBeNull();
    expect(groupMark("rollo10m")).toBe("▸ Por 10 m");
  });
});

describe("tarjeta", () => {
  it("caja después del precio en oferta y atenúa las líneas de Coto", async () => {
    const { doc, send } = setup(offerCard(K(1)));
    send({ type: "labels", labels: { [K(1)]: L(5177.44, { bankBlocked: "oferta" }) } });
    await tick();
    const box = doc.querySelector(".coto-unit-box");
    expect(box.previousElementSibling.className).toBe("descuentos-slot");
    expect(box.querySelector(".coto-unit-cap").textContent).toBe("Precio real para comparar");
    expect(box.querySelector(".coto-unit-value").textContent).toBe("$5.177 /kg");
    expect(box.querySelector(".coto-unit-bankno").textContent).toBe("Banco no aplica: ya está en oferta");
    const smalls = [...doc.querySelectorAll(".centro-precios small:not(.offer-crum)")];
    expect(smalls.every((s) => s.hasAttribute("data-coto-unit-dim"))).toBe(true);
    expect(smalls[0].hasAttribute("data-coto-unit-strike")).toBe(true);
    expect(doc.querySelector(".bottom-botones button").textContent).toBe("Agregar");
  });

  it("sin oferta no tacha 'Precio Regular' (no hay descuento)", async () => {
    const html = `<div class="card-container"><a href="/productos/x/${K(4)}">foto</a><div class="centro-precios">
      <div class="descuentos-slot"><h4 class="card-title">$2.639,00</h4></div>
      <small class="card-text">Precio regular: $2.639,00</small></div></div>`;
    const { doc, send } = setup(html);
    send({ type: "labels", labels: { [K(4)]: L(6598) } });
    await tick();
    const reg = doc.querySelector("small");
    expect(reg.hasAttribute("data-coto-unit-dim")).toBe(true);
    expect(reg.hasAttribute("data-coto-unit-strike")).toBe(false);
  });

  it("sin oferta: caja después del h4 y línea de banco", async () => {
    const { doc, send } = setup(plainCard(K(2)));
    send({ type: "settings", selected: [], day: new Date().getDay() });
    send({ type: "labels", labels: { [K(2)]: L(9100, { bankValue: 6370, bankName: "ICBC", take: 3 }) } });
    await tick();
    const box = doc.querySelector(".coto-unit-box");
    expect(box.previousElementSibling.tagName).toBe("H4");
    expect(box.querySelector(".coto-unit-note").textContent).toBe("llevando 3");
    expect(box.querySelector(".coto-unit-bank").textContent).toBe("Hoy con ICBC: $6.370/kg");
  });

  it("'Más barato' solo con 3 o más tarjetas del grupo", async () => {
    const { doc, send } = setup(plainCard(K(1)) + plainCard(K(2)) + plainCard(K(3)));
    send({ type: "labels", labels: { [K(1)]: L(900), [K(2)]: L(500, { bankValue: 450, bankName: "X" }), [K(3)]: L(700) } });
    await tick();
    const best = doc.querySelectorAll(".coto-unit-best");
    expect(best).toHaveLength(1);
    expect(best[0].textContent).toBe("Más barato por kg");
    expect(best[0].closest(".card-container").querySelector("a").getAttribute("href")).toContain(K(2));

    const two = setup(plainCard(K(1)) + plainCard(K(2)));
    two.send({ type: "labels", labels: { [K(1)]: L(900), [K(2)]: L(500) } });
    await tick();
    expect(two.doc.querySelector(".coto-unit-best")).toBeNull();
  });

  it("marcas de grupo por seq y aviso", async () => {
    const { doc, send } = setup(`<div class="plp-header__sort"></div>` + plainCard(K(1)));
    send({ type: "labels", labels: { [K(1)]: L(1) }, marks: { [K(1)]: "kg" }, seq: 5 });
    send({ type: "labels", labels: {}, marks: null, seq: 4 });
    send({ type: "notice", text: "Se ordenaron los primeros 1.000 productos", seq: 5 });
    await tick();
    expect(doc.querySelector(".coto-unit-mark").textContent).toBe("▸ Por kilo");
    expect(doc.querySelector(".coto-unit-notice")).not.toBeNull();
    send({ type: "labels", labels: {}, marks: null, seq: 6 });
    await tick();
    expect(doc.querySelector(".coto-unit-mark, .coto-unit-notice")).toBeNull();
  });

  it("al cambiar configuración borra líneas de banco viejas", async () => {
    const { doc, send } = setup(plainCard(K(1)));
    send({ type: "settings", selected: [{ id: "457" }], day: 1 });
    send({ type: "labels", labels: { [K(1)]: L(1000, { bankValue: 700, bankName: "ICBC" }) } });
    await tick();
    expect(doc.querySelector(".coto-unit-bank")).not.toBeNull();
    send({ type: "settings", selected: [{ id: "457" }], day: 3 });
    await tick();
    expect(doc.querySelector(".coto-unit-bank")).toBeNull();
  });

  it("ignora mensajes de otros", async () => {
    const { win, doc } = setup(plainCard(K(1)));
    win.dispatchEvent(new MessageEvent("message", { data: { source: "otro", type: "labels", labels: { [K(1)]: L(1) } } }));
    await tick();
    expect(doc.querySelector(".coto-unit-box")).toBeNull();
  });
});

describe("página de producto", () => {
  it("pide por PLU y pone la caja después del precio", async () => {
    const key = "_/R-00217832-00217832-200";
    const { win, doc, send } = setup(`<article><div><span class="price h3">$2.738,54</span></div></article>`, `/productos/ravioles/${key}`);
    expect(win.posted).toContainEqual({ source: "coto-unit", type: "lookup", plu: "217832", key });
    send({ type: "labels", labels: { [key]: L(9597.08) } });
    await tick();
    const box = doc.querySelector(".coto-unit-box");
    expect(box.previousElementSibling.className).toBe("price h3");
    expect(box.querySelector(".coto-unit-value").textContent).toBe("$9.597 /kg");
  });
});

describe("revisión final: tarjeta", () => {
  it("si la etiqueta desaparece, saca atenuado y tachado", async () => {
    const { doc, send } = setup(offerCard(K(1)));
    send({ type: "labels", labels: { [K(1)]: L(5177.44) } });
    await tick();
    expect(doc.querySelector("[data-coto-unit-strike]")).not.toBeNull();
    send({ type: "labels", labels: { [K(1)]: L(null, { group: "sin_dato" }) } });
    await tick();
    expect(doc.querySelector("[data-coto-unit-strike], [data-coto-unit-dim], .coto-unit-box")).toBeNull();
  });

  it("'Más barato' cuenta tarjetas, no links", async () => {
    const twoLinks = (key) => plainCard(key).replace("</a>", `</a><a href="/productos/x/${key}">otro</a>`);
    const { doc, send } = setup(twoLinks(K(1)) + twoLinks(K(2)));
    send({ type: "labels", labels: { [K(1)]: L(900), [K(2)]: L(500) } });
    await tick();
    expect(doc.querySelector(".coto-unit-best")).toBeNull();
  });
});

describe("v4: página de producto real", () => {
  const key = "_/R-00621756-00621756-200";
  const pdp = `<div class="mt-4">
      <div class="mb-1"></div>
      <div class="ng-star-inserted"><div class="badge">Oferta</div><div>30%Dto</div>
        <div class="mb-1"><var class="price h3"> $3.498,59 </var></div><span>No acumulable con otras promos</span></div>
      <div class="mt-2 small">Precio regular: <span>$5.099,99</span></div>
      <div class="mb-2">Precio sin impuestos nacionales: $4.214,87</div>
      <div class="mb-5 small">Precio por 1 Cuadrado : $159,38</div>
    </div>`;

  it("la caja va a lo ancho debajo del bloque de precio y atenúa lo secundario", async () => {
    const { doc, send } = setup(pdp, `/productos/papel/${key}`);
    send({ type: "labels", labels: { [key]: L(109.33, { group: "rollo10m", note: "≈ ancho 10 cm" }) } });
    await tick();
    const box = doc.querySelector(".coto-unit-box");
    expect(box.parentElement.className).toBe("mt-4");
    expect(box.previousElementSibling.querySelector(".price")).not.toBeNull();
    expect(box.classList.contains("coto-unit-box--pdp")).toBe(true);
    const regular = doc.querySelector(".mt-2.small");
    expect(regular.hasAttribute("data-coto-unit-dim")).toBe(true);
    expect(regular.hasAttribute("data-coto-unit-strike")).toBe(true);
    expect(doc.querySelector(".mb-5").hasAttribute("data-coto-unit-dim")).toBe(true);
    expect(doc.querySelector(".mb-2").hasAttribute("data-coto-unit-dim")).toBe(true);
  });

  it("sin oferta no tacha el precio regular", async () => {
    const plain = pdp.replace('<div class="badge">Oferta</div><div>30%Dto</div>', "");
    const { doc, send } = setup(plain, `/productos/papel/${key}`);
    send({ type: "labels", labels: { [key]: L(109.33, { group: "rollo10m" }) } });
    await tick();
    expect(doc.querySelector(".mt-2.small").hasAttribute("data-coto-unit-strike")).toBe(false);
  });
});

describe("v4: carrusel de recomendaciones", () => {
  const mini = (id) => `<div class="swiper-slide"><mini-product-card><div class="mini-product-card" data-cnstrc-item-id="${id}">
      <div class="mini-product-card__body"><p class="mini-product-card__name">Felpita</p>
        <div class="mini-product-card__price-section"><span class="mini-product-card__price"> $13.640,00 </span></div>
        <p class="mini-product-card__unit">1 UNI</p>
        <small class="mini-product-card__reference-price"> Precio por 1 Cuadrado: $189,45 </small>
        <product-add-show-remove><button>Agregar</button></product-add-show-remove></div></div></mini-product-card></div>`;

  it("pone una caja compacta en cada tarjeta, también en las duplicadas", async () => {
    const { doc, send } = setup(mini("prod00632358") + mini("prod00632358") + mini("prod00000001"));
    send({ type: "labels", labels: { prod00632358: L(189.44, { group: "rollo10m" }) } });
    await tick();
    const boxes = doc.querySelectorAll(".coto-unit-box--mini");
    expect(boxes).toHaveLength(2);
    expect(boxes[0].previousElementSibling.className).toBe("mini-product-card__price-section");
    expect(boxes[0].querySelector(".coto-unit-value").textContent).toBe("$189 /10 m");
    expect(boxes[0].querySelector(".coto-unit-cap")).toBeNull();
    send({ type: "labels", labels: { prod00632358: L(189.44, { group: "rollo10m", bankValue: 132.61, bankName: "ICBC" }) } });
    await tick();
    expect(doc.querySelector(".coto-unit-box--mini .coto-unit-bank").textContent).toBe("ICBC: $133");
    expect(doc.querySelector(".mini-product-card__reference-price").hasAttribute("data-coto-unit-dim")).toBe(true);
  });
});

describe("v4: ajuste 'marcar el más barato'", () => {
  it("apagado, no pone el cartel", async () => {
    const { doc, send } = setup(offerCard(K(1)) + offerCard(K(2)) + offerCard(K(3)));
    send({ type: "settings", selected: [], day: 1, markBest: false });
    send({ type: "labels", labels: { [K(1)]: L(10), [K(2)]: L(20), [K(3)]: L(30) } });
    await tick();
    expect(doc.querySelector(".coto-unit-best")).toBeNull();
    send({ type: "settings", selected: [], day: 1, markBest: true });
    await tick();
    expect(doc.querySelector(".coto-unit-best")).not.toBeNull();
  });
});

describe("revisión v4: PDP no atenúa bloques grandes", () => {
  it("un hermano con botones o mucho texto no se toca", async () => {
    const key = "_/R-00621756-00621756-200";
    const html = `<div class="mt-4"><div><var class="price">$100</var></div>
      <div class="mt-2 small">Precio regular: $150</div>
      <div class="big">Precio por 1 Kilo y mucho más <button>Agregar</button></div></div>`;
    const { doc, send } = setup(html, `/productos/x/${key}`);
    send({ type: "labels", labels: { [key]: L(10) } });
    await tick();
    expect(doc.querySelector(".mt-2").hasAttribute("data-coto-unit-dim")).toBe(true);
    expect(doc.querySelector(".big").hasAttribute("data-coto-unit-dim")).toBe(false);
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

const EAN_A = "7790070318213";
const EAN_B = "7790070318220";
const CMP = { unit: 2225, qty: 1 };
const RES = { carrefour: { unit: 2049, qty: 1, promo: null }, dia: { unit: 1899, qty: 2, promo: "x" }, mas: { unit: 2229, qty: 1, promo: null } };
const prices = (doc) => [...doc.querySelectorAll(".coto-unit-cmp-price")].map((p) => p.textContent);

describe("v5: comparar con otros súper", () => {
  it("filas '…' mientras espera y precios al llegar; un solo pedido", async () => {
    const compare = fakeCompare();
    const { doc, send } = setup(offerCard(K(1)), undefined, { compare });
    send({ type: "labels", labels: { [K(1)]: L(5177, { ean: EAN_A, cmp: CMP }) } });
    await tick();
    const box = doc.querySelector(".coto-unit-box");
    expect(box.getAttribute("data-coto-unit-ean")).toBe(EAN_A);
    expect(box.lastElementChild.className).toBe("coto-unit-cmp");
    expect(prices(doc)).toEqual(["…", "…", "…"]);
    send({ type: "labels", labels: { [K(1)]: L(5177, { ean: EAN_A, cmp: CMP }) } });
    await tick();
    expect(compare.asked).toEqual([EAN_A]);
    await compare.resolve(EAN_A, RES);
    expect(prices(doc)).toEqual(["▼ $2.049", "▼ $1.899", "= $2.229"]);
    expect(doc.querySelector(".coto-unit-cmp-qty").textContent).toBe("llevando 2");
    expect(compare.asked).toEqual([EAN_A]);
  });

  it("sin EAN no hay bloque ni pedido", async () => {
    const compare = fakeCompare();
    const { doc, send } = setup(offerCard(K(1)), undefined, { compare });
    send({ type: "labels", labels: { [K(1)]: L(5177, { ean: null, cmp: null }) } });
    await tick();
    expect(doc.querySelector(".coto-unit-box")).not.toBeNull();
    expect(doc.querySelector(".coto-unit-cmp")).toBeNull();
    expect(compare.asked).toEqual([]);
  });

  it("sin cliente de comparación no hay bloque", async () => {
    const { doc, send } = setup(offerCard(K(1)));
    send({ type: "labels", labels: { [K(1)]: L(5177, { ean: EAN_A, cmp: CMP }) } });
    await tick();
    expect(doc.querySelector(".coto-unit-cmp")).toBeNull();
  });

  it("si la tarjeta cambia de producto, muestra el EAN nuevo y no el viejo", async () => {
    const compare = fakeCompare();
    const { doc, send } = setup(offerCard(K(1)), undefined, { compare });
    send({ type: "labels", labels: { [K(1)]: L(5177, { ean: EAN_A, cmp: CMP }) } });
    await tick();
    await compare.resolve(EAN_A, RES);
    expect(prices(doc)[1]).toBe("▼ $1.899");
    send({ type: "labels", labels: { [K(1)]: L(5177, { ean: EAN_B, cmp: CMP }) } });
    await tick();
    expect(doc.querySelector(".coto-unit-box").getAttribute("data-coto-unit-ean")).toBe(EAN_B);
    expect(prices(doc)).toEqual(["…", "…", "…"]);
    await compare.resolve(EAN_B, { carrefour: "missing", dia: { unit: 2600, qty: 1, promo: null }, mas: "missing" });
    expect(prices(doc)).toEqual(["—", "▲ $2.600", "—"]);
    expect(compare.asked).toEqual([EAN_A, EAN_B]);
  });

  it("apagado en ajustes: borra los bloques y lo que llega tarde no pinta", async () => {
    const compare = fakeCompare();
    const { doc, send } = setup(offerCard(K(1)) + offerCard(K(2)), undefined, { compare });
    send({ type: "labels", labels: { [K(1)]: L(5177, { ean: EAN_A, cmp: CMP }), [K(2)]: L(10, { ean: EAN_B, cmp: CMP }) } });
    await tick();
    await compare.resolve(EAN_A, RES);
    expect(doc.querySelectorAll(".coto-unit-cmp")).toHaveLength(2);
    send({ type: "settings", selected: [], day: 1, compareStores: false });
    await tick();
    expect(doc.querySelectorAll(".coto-unit-cmp")).toHaveLength(0);
    await compare.resolve(EAN_B, RES);
    send({ type: "labels", labels: { [K(1)]: L(5177, { ean: EAN_A, cmp: CMP }) } });
    await tick();
    expect(doc.querySelectorAll(".coto-unit-cmp")).toHaveLength(0);
    expect(doc.querySelectorAll(".coto-unit-box")).toHaveLength(2);
    expect(compare.asked).toEqual([EAN_A, EAN_B]);
    send({ type: "settings", selected: [], day: 1, compareStores: true });
    await tick();
    expect(doc.querySelectorAll(".coto-unit-cmp")).toHaveLength(2);
    expect(compare.asked).toEqual([EAN_A, EAN_B]);
  });

  it("con IntersectionObserver pide recién cuando la caja se ve, una sola vez", async () => {
    const observers = [];
    class FakeIO {
      constructor(cb) { this.cb = cb; this.targets = new Set(); observers.push(this); }
      observe(t) { this.targets.add(t); }
      unobserve(t) { this.targets.delete(t); }
      disconnect() { this.targets.clear(); }
      show(t) { this.cb([{ target: t, isIntersecting: true }], this); }
    }
    const compare = fakeCompare();
    const { doc, send } = setup(offerCard(K(1)), undefined, { compare, IntersectionObserver: FakeIO });
    send({ type: "labels", labels: { [K(1)]: L(5177, { ean: EAN_A, cmp: CMP }) } });
    await tick();
    const box = doc.querySelector(".coto-unit-box");
    expect(prices(doc)).toEqual(["…", "…", "…"]);
    expect(compare.asked).toEqual([]);
    expect(observers[0].targets.has(box)).toBe(true);
    observers[0].show(box);
    observers[0].show(box);
    send({ type: "labels", labels: { [K(1)]: L(5177, { ean: EAN_A, cmp: CMP }) } });
    await tick();
    expect(compare.asked).toEqual([EAN_A]);
    expect(observers[0].targets.has(box)).toBe(false);
  });
});
