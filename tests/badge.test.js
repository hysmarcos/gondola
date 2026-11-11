// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { installBadges, formatUnit, formatWhy, formatNote, formatBlocked, groupMark } from "../src/badge.js";

const K = (n) => `_/R-0000000${n}-0000000${n}-200`;
// Tarjetas con la estructura real de Coto (listas de categoría, 2026-11).
const offerCard = (key, name = "Gaseosa Pomelo Cunnington 2250ml") => `
  <div class="card-container"><div class="top-imagen-promos"><span class="cucarda-promo">40%DTO</span>
    <a href="/productos/x/${key}"><img class="product-image"></a></div>
    <div class="centro-precios"><h3 class="nombre-producto">${name}</h3>
      <div class="descuentos-slot"><small class="offer-crum"> PRECIO CON 40%DTO </small><h4 class="card-title"> $1.650,00 </h4></div>
      <div class="d-flex flex-column"><small class="card-text"> Precio Regular: $2.750,00 </small><small class="text-center"> Precio sin impuestos nacionales: $2.272,73 </small></div>
      <div class="w-100"></div>
      <div class="text-center"><small class="card-text"> Precio por 1 Litro: $1.222,22 </small></div>
      <div class="bottom-botones"><product-add-show-remove><button>Agregar</button></product-add-show-remove><a href="javascript:void(0)">Ver planes de cuotas</a></div>
    </div></div>`;
const plainCard = (key) => `
  <div class="card-container"><a href="/productos/x/${key}"></a>
    <div class="centro-precios"><h3 class="nombre-producto">Gaseosa SPRITE 2,25 L</h3><h4 class="card-title">$6.100,00</h4>
      <small class="text-center">Precio regular: $6.100,00</small><small class="text-center">Precio sin impuestos nacionales: $5.041,32</small>
      <div class="text-center"><small class="card-text">Precio por 1 Litro: $2.711,11</small></div>
      <div class="bottom-botones"><button>Agregar</button></div></div></div>`;
const comunidadCard = (key) => offerCard(key, "Gaseosa Cola Original Coto 2250cc")
  .replace("</div>\n      <div class=\"d-flex", `</div><div class="descuentos-slot"><small class="offer-crum"> +5% CON COMUNIDAD </small><h4 class="card-title"> $1.599,99 </h4></div>
      <div class="d-flex`)
  .replace('<div class="w-100"></div>', '<div class="comunidad-banner"><span>CON</span> <span>COMUNIDAD</span> <span>PAGAS $1.599,99</span></div>');

const L = (value, extra = {}) => ({
  group: "kg", value, drained: false, take: 1, note: null, bankValue: null, bankName: null, bankBlocked: null,
  price: 1650, list: 2750, via: "oferta", offerText: "40% dto", ...extra,
});
const tick = () => new Promise((r) => setTimeout(r, 0));

function setup(html, path = "/productos/categorias/x", opts) {
  const win = new EventTarget();
  win.location = { pathname: path };
  win.posted = [];
  win.postMessage = (m) => win.posted.push(m);
  win.MutationObserver = opts?.MutationObserver ?? window.MutationObserver;
  const doc = document.implementation.createHTMLDocument("x");
  doc.body.innerHTML = html;
  if (opts?.IntersectionObserver) win.IntersectionObserver = opts.IntersectionObserver;
  installBadges(win, doc, opts);
  const send = (data) => win.dispatchEvent(new MessageEvent("message", { data: { source: "coto-unit", ...data } }));
  return { win, doc, send };
}

const hidden = (el) => el.hasAttribute("data-coto-unit-hide");

describe("textos", () => {
  it("un solo precio por unidad, con su motivo", () => {
    expect(formatUnit(L(5177.4))).toBe("$5.177 /kg");
    expect(formatUnit(L(5177.4, { bankValue: 3624.2, bankName: "ICBC" }))).toBe("$3.624 /kg");
    expect(formatUnit(L(206.35, { group: "rollo10m" }))).toBe("$206 /10 m");
    expect(formatUnit(L(null, { group: "sin_dato" }))).toBeNull();
    expect(formatWhy(L(1, { bankValue: 1, bankName: "ICBC" }), 1, 1)).toBe("con ICBC hoy");
    expect(formatWhy(L(1, { bankValue: 1, bankName: "ICBC" }), 2, 1)).toBe("con ICBC el martes");
    expect(formatWhy(L(1, { bankValue: 1, bankName: "ICBC" }), 1, 1, true)).toBe("ICBC");
    expect(formatWhy(L(1, { take: 2 }), 1, 1)).toBe("llevando 2");
    expect(formatWhy(L(1, { via: "comunidad" }), 1, 1)).toBe("con Comunidad");
    expect(formatWhy(L(1, { via: "1pago" }), 1, 1)).toBe("en 1 pago");
    expect(formatWhy(L(1), 1, 1)).toBeNull();
    expect(formatNote(L(1, { drained: true, note: "doble hoja" }))).toBe("escurrido · doble hoja");
    expect(formatNote(L(1, { take: 3 }))).toBeNull();
    expect(formatBlocked("oferta")).toBe("Banco no aplica: ya está en oferta");
    expect(formatBlocked(null)).toBeNull();
    expect(groupMark("rollo10m")).toBe("▸ Por 10 m");
  });
});

describe("tarjeta unificada", () => {
  it("un bloque propio con oferta, precio, regular y precio por unidad", async () => {
    const { doc, send } = setup(offerCard(K(1)));
    send({ type: "labels", labels: { [K(1)]: L(733.33, { group: "L" }) } });
    await tick();
    const block = doc.querySelector(".coto-unit-price");
    expect(block.previousElementSibling.className).toBe("nombre-producto");
    expect([...block.children].map((c) => c.className)).toEqual(["coto-unit-pricerow", "coto-unit-detail", "coto-unit-cmprow", "coto-unit-unit"]);
    // La oferta va una sola vez, como etiqueta sobre la imagen; las cucardas de Coto se ocultan.
    const tags = doc.querySelector(".top-imagen-promos .coto-unit-tags");
    expect(tags.querySelector(".coto-unit-offer").textContent).toBe("40% dto");
    expect(hidden(doc.querySelector(".cucarda-promo"))).toBe(true);
    expect(block.querySelector(".coto-unit-detail").hasAttribute("data-coto-unit-empty")).toBe(true);
    expect(block.querySelector(".coto-unit-final").textContent).toBe("$1.650,00");
    expect(block.querySelector(".coto-unit-regular").textContent).toBe("$2.750,00");
    expect(block.querySelector(".coto-unit-value").textContent).toBe("$733 /L");
    expect(block.querySelector(".coto-unit-why")).toBeNull();
    expect(doc.querySelector(".card-container").hasAttribute("data-coto-unit-card")).toBe(true);
  });

  it("oculta lo que Coto repetía y deja 'sin impuestos' chico", async () => {
    const { doc, send } = setup(offerCard(K(1)));
    send({ type: "labels", labels: { [K(1)]: L(733.33, { group: "L" }) } });
    await tick();
    expect(hidden(doc.querySelector(".descuentos-slot"))).toBe(true);
    expect(hidden([...doc.querySelectorAll("small")].find((s) => /Precio Regular/.test(s.textContent)))).toBe(true);
    expect(hidden([...doc.querySelectorAll(".text-center")].find((s) => /Precio por 1/.test(s.textContent)))).toBe(true);
    const tax = [...doc.querySelectorAll("small")].find((s) => /sin impuestos/.test(s.textContent));
    expect(hidden(tax)).toBe(false);
    expect(tax.hasAttribute("data-coto-unit-dim")).toBe(true);
    expect(hidden(doc.querySelector(".bottom-botones"))).toBe(false);
  });

  it("Comunidad: una sola oferta, un solo precio, sin el banner repetido", async () => {
    const { doc, send } = setup(comunidadCard(K(1)));
    send({ type: "labels", labels: { [K(1)]: L(711.1, { group: "L", price: 1599.99, list: 1999.99, via: "comunidad", offerText: "15% dto + 5% Comunidad" }) } });
    await tick();
    expect(doc.querySelectorAll(".descuentos-slot")).toHaveLength(2);
    expect([...doc.querySelectorAll(".descuentos-slot")].every(hidden)).toBe(true);
    expect(hidden(doc.querySelector(".comunidad-banner"))).toBe(true);
    expect(doc.querySelector(".coto-unit-tags .coto-unit-offer").textContent).toBe("15% dto + 5% Comunidad");
    expect(doc.querySelector(".coto-unit-detail").textContent).toBe("con Comunidad");
  });

  it("sin oferta: no hay precio tachado ni oferta", async () => {
    const { doc, send } = setup(plainCard(K(1)));
    send({ type: "labels", labels: { [K(1)]: L(2711.11, { group: "L", price: 6100, list: 6100, via: "lista", offerText: null }) } });
    await tick();
    expect(doc.querySelector(".coto-unit-regular")).toBeNull();
    expect(doc.querySelector(".coto-unit-offer")).toBeNull();
    expect(doc.querySelector(".coto-unit-tags")).toBeNull();
    expect(hidden(doc.querySelector("h4.card-title"))).toBe(true);
  });

  it("con banco: el precio por unidad ya es con banco y lo dice", async () => {
    const { doc, send } = setup(plainCard(K(1)));
    send({ type: "settings", selected: [{ id: "457" }], day: new Date().getDay() });
    send({ type: "labels", labels: { [K(1)]: L(933.33, { group: "L", bankValue: 653.33, bankName: "ICBC", bankPrice: 1960, bankPercent: 30, price: 2800, list: 2800, offerText: null }) } });
    await tick();
    expect(doc.querySelector(".coto-unit-final").textContent).toBe("$1.960,00");
    expect(doc.querySelector(".coto-unit-regular").textContent).toBe("$2.800,00");
    expect(doc.querySelector(".coto-unit-detail").textContent).toBe("con ICBC 30% hoy");
    expect(doc.querySelector(".coto-unit-value").textContent).toBe("$653 /L");
    expect(doc.querySelector(".coto-unit-unit .coto-unit-why")).toBeNull();
    send({ type: "settings", selected: [{ id: "457" }], day: (new Date().getDay() + 1) % 7 });
    await tick();
    expect(doc.querySelector(".coto-unit-value").textContent).toBe("$933 /L");
    expect(doc.querySelector(".coto-unit-why")).toBeNull();
  });

  it("si la etiqueta desaparece, la tarjeta vuelve a ser la de Coto", async () => {
    const { doc, send } = setup(offerCard(K(1)));
    send({ type: "labels", labels: { [K(1)]: L(733.33) } });
    await tick();
    send({ type: "labels", labels: { [K(1)]: L(null, { group: "sin_dato" }) } });
    await tick();
    expect(doc.querySelector(".coto-unit-price, [data-coto-unit-hide], [data-coto-unit-dim], [data-coto-unit-card]")).toBeNull();
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

  it("ignora mensajes de otros", async () => {
    const { win, doc } = setup(plainCard(K(1)));
    win.dispatchEvent(new MessageEvent("message", { data: { source: "otro", type: "labels", labels: { [K(1)]: L(1) } } }));
    await tick();
    expect(doc.querySelector(".coto-unit-price")).toBeNull();
  });
});

describe("más barato de la categoría", () => {
  it("solo en el producto que manda el intermediario, en cualquier página", async () => {
    const { doc, send } = setup(offerCard(K(1)) + offerCard(K(2)) + offerCard(K(3)));
    send({ type: "labels", labels: { [K(1)]: L(10), [K(2)]: L(5), [K(3)]: L(30) } });
    await tick();
    expect(doc.querySelector(".coto-unit-best")).toBeNull(); // el más barato de la página no alcanza
    send({ type: "best", best: { [K(3)]: "kg" }, seq: 2 });
    await tick();
    const best = doc.querySelectorAll(".coto-unit-best");
    expect(best).toHaveLength(1);
    expect(best[0].textContent).toBe("Más barato de la categoría");
    expect(best[0].closest(".card-container").querySelector("a").getAttribute("href")).toContain(K(3));
  });

  it("un mensaje viejo no pisa al nuevo, y el ajuste lo apaga", async () => {
    const { doc, send } = setup(offerCard(K(1)) + offerCard(K(2)));
    send({ type: "labels", labels: { [K(1)]: L(10), [K(2)]: L(5) } });
    send({ type: "best", best: { [K(2)]: "kg" }, seq: 5 });
    send({ type: "best", best: { [K(1)]: "kg" }, seq: 4 });
    await tick();
    expect(doc.querySelector(".coto-unit-best").closest(".card-container").querySelector("a").getAttribute("href")).toContain(K(2));
    send({ type: "settings", selected: [], day: 1, markBest: false });
    await tick();
    expect(doc.querySelector(".coto-unit-best")).toBeNull();
  });
});

describe("página de producto", () => {
  const key = "_/R-00621756-00621756-200";
  const pdp = `<div class="mt-4">
      <div class="mb-1"></div>
      <div class="ng-star-inserted"><div class="badge">Oferta</div><div>30%Dto</div>
        <div class="mb-1"><var class="price h3"> $3.498,59 </var></div><span>No acumulable con otras promos</span></div>
      <div class="mt-2 small">Precio regular: <span>$5.099,99</span></div>
      <div class="mb-2">Precio sin impuestos nacionales: $4.214,87</div>
      <div class="mb-5 small">Precio por 1 Cuadrado : $159,38</div>
    </div>`;

  it("pide por PLU; caja a lo ancho; oculta 'Precio por 1' y atenúa lo demás", async () => {
    const { win, doc, send } = setup(pdp, `/productos/papel/${key}`);
    expect(win.posted).toContainEqual({ source: "coto-unit", type: "lookup", plu: "621756", key });
    send({ type: "labels", labels: { [key]: L(109.33, { group: "rollo10m", note: "≈ ancho 10 cm", bankBlocked: "oferta" }) } });
    await tick();
    const box = doc.querySelector(".coto-unit-box--pdp");
    expect(box.parentElement.className).toBe("mt-4");
    // La caja va después de "Precio regular" y "sin impuestos": esas líneas quedan pegadas al precio.
    expect(box.previousElementSibling).toBe(doc.querySelector(".mb-5"));
    expect(doc.querySelector(".mt-2.small").previousElementSibling.querySelector(".price")).not.toBeNull();
    expect(box.querySelector(".coto-unit-cap").textContent).toBe("Precio real para comparar");
    expect(box.querySelector(".coto-unit-value").textContent).toBe("$109 /10 m");
    expect(box.querySelector(".coto-unit-note").textContent).toBe("≈ ancho 10 cm");
    expect(box.querySelector(".coto-unit-bankno").textContent).toBe("Banco no aplica: ya está en oferta");
    const regular = doc.querySelector(".mt-2.small");
    expect(regular.hasAttribute("data-coto-unit-dim")).toBe(true);
    expect(regular.hasAttribute("data-coto-unit-strike")).toBe(true);
    expect(hidden(doc.querySelector(".mb-5"))).toBe(true);
    expect(doc.querySelector(".mb-2").hasAttribute("data-coto-unit-dim")).toBe(true);
  });

  it("información nutricional: pinta debajo de la caja y respeta el ajuste", async () => {
    const calls = [];
    const nutrition = { paint: (...args) => calls.push(args) };
    const { doc, send } = setup(pdp, `/productos/papel/${key}`, { nutrition });
    const label = L(109.33, { group: "rollo10m", ean: "7790895000997", nutri: true });
    send({ type: "labels", labels: { [key]: label } });
    await tick();
    const box = doc.querySelector(".coto-unit-box--pdp");
    const last = calls.at(-1);
    expect(last[0]).toBe(doc.querySelector(".mt-4"));
    expect(last[1]).toBe(box);
    expect(last[2]).toMatchObject({ ean: "7790895000997", nutri: true });
    expect(last[3]).toBe(true);
    // Sin "Descripción del producto" no hay sección: desplegable en la columna.
    expect(last[4]).toBeNull();
    send({ type: "settings", selected: [], day: 1, nutrition: false });
    await tick();
    expect(calls.at(-1)[3]).toBe(false);
  });

  it("con Descripción del producto, la sección va junto a ella", async () => {
    const calls = [];
    const nutrition = { paint: (...args) => calls.push(args) };
    const withDesc = pdp + `<div class="col-12 mt-3 mb-5"><div class="mb-3 pdp-description"><h4>Descripción del producto</h4></div><div class="pdp-characteristics"></div></div>`;
    const { doc, send } = setup(withDesc, `/productos/papel/${key}`, { nutrition });
    send({ type: "labels", labels: { [key]: L(109.33, { group: "rollo10m", ean: "1", nutri: true }) } });
    await tick();
    const section = calls.at(-1)[4];
    expect(section.after).toBe(doc.querySelector(".pdp-description"));
    expect(section.host).toBe(doc.querySelector(".col-12.mt-3.mb-5"));
  });

  it("la galería de Coto se pasa a la información nutricional", async () => {
    const calls = [];
    const nutrition = { paint: (...args) => calls.push(args) };
    const html = `<article class="gallery-wrap"><div class="img-big-wrap"></div><div class="thumbs-wrap"></div></article>` + pdp;
    const { doc, send } = setup(html, `/productos/papel/${key}`, { nutrition });
    send({ type: "labels", labels: { [key]: L(109.33, { group: "rollo10m", ean: "1", nutri: true }) } });
    await tick();
    const gallery = calls.at(-1)[5];
    expect(gallery.thumbs).toBe(doc.querySelector(".thumbs-wrap"));
    expect(gallery.big).toBe(doc.querySelector(".img-big-wrap"));
  });

  it("una etiqueta de lista sin tacc ni nombre no borra los de la búsqueda por PLU", async () => {
    const calls = [];
    const nutrition = { paint: (...args) => calls.push(args) };
    const { send } = setup(pdp, `/productos/papel/${key}`, { nutrition });
    send({ type: "labels", labels: { [key]: L(109.33, { group: "rollo10m", ean: "1", nutri: true, tacc: "SI", name: "Leche" }) } });
    await tick();
    send({ type: "labels", labels: { [key]: L(109.33, { group: "rollo10m", ean: "1", nutri: true }) } });
    await tick();
    expect(calls.at(-1)[2]).toMatchObject({ tacc: "SI", name: "Leche" });
    // Otro producto (otro EAN): no hereda nada.
    send({ type: "labels", labels: { [key]: L(109.33, { group: "rollo10m", ean: "2", nutri: true }) } });
    await tick();
    expect(calls.at(-1)[2].tacc).toBeUndefined();
  });

  it("refresh vuelve a pintar la información nutricional", async () => {
    const calls = [];
    const nutrition = { paint: (...args) => calls.push(args) };
    const win = new EventTarget();
    win.location = { pathname: `/productos/papel/${key}` };
    win.postMessage = () => {};
    win.MutationObserver = window.MutationObserver;
    const doc = document.implementation.createHTMLDocument("x");
    doc.body.innerHTML = pdp;
    const badges = installBadges(win, doc, { nutrition });
    const before = calls.length;
    badges.refresh();
    await tick();
    expect(calls.length).toBeGreaterThan(before);
  });

  it("si Coto dibuja una línea de precio después de la caja, la caja baja", async () => {
    const { doc, send } = setup(pdp, `/productos/papel/${key}`);
    send({ type: "labels", labels: { [key]: L(109.33, { group: "rollo10m" }) } });
    await tick();
    const box = doc.querySelector(".coto-unit-box--pdp");
    const late = doc.createElement("div");
    late.textContent = "Precio con tarjeta Coto: $3.000";
    box.after(late);
    await tick();
    expect(doc.querySelector(".coto-unit-box--pdp").previousElementSibling).toBe(late);
  });

  it("sin oferta no tacha el precio regular", async () => {
    const plain = pdp.replace('<div class="badge">Oferta</div><div>30%Dto</div>', "");
    const { doc, send } = setup(plain, `/productos/papel/${key}`);
    send({ type: "labels", labels: { [key]: L(109.33, { group: "rollo10m" }) } });
    await tick();
    expect(doc.querySelector(".mt-2.small").hasAttribute("data-coto-unit-strike")).toBe(false);
  });

  it("un hermano con botones o mucho texto no se toca", async () => {
    const html = `<div class="mt-4"><div><var class="price">$100</var></div>
      <div class="mt-2 small">Precio regular: $150</div>
      <div class="big">Precio por 1 Kilo y mucho más <button>Agregar</button></div></div>`;
    const { doc, send } = setup(html, `/productos/x/${key}`);
    send({ type: "labels", labels: { [key]: L(10) } });
    await tick();
    expect(doc.querySelector(".mt-2").hasAttribute("data-coto-unit-dim")).toBe(true);
    expect(hidden(doc.querySelector(".big"))).toBe(false);
  });
});

describe("carrusel de recomendaciones", () => {
  const mini = (id) => `<div class="swiper-slide"><mini-product-card><div class="mini-product-card" data-cnstrc-item-id="${id}">
      <div class="mini-product-card__body"><p class="mini-product-card__name">Felpita</p>
        <div class="mini-product-card__price-section"><span class="mini-product-card__price"> $13.640,00 </span></div>
        <p class="mini-product-card__unit">1 UNI</p>
        <small class="mini-product-card__reference-price"> Precio por 1 Cuadrado: $189,45 </small>
        <product-add-show-remove><button>Agregar</button></product-add-show-remove></div></div></mini-product-card></div>`;

  it("una fila compacta por tarjeta, también en las duplicadas", async () => {
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
    expect(doc.querySelector(".coto-unit-box--mini .coto-unit-value").textContent).toBe("$133 /10 m");
    expect(doc.querySelector(".coto-unit-box--mini .coto-unit-why").textContent).toBe("ICBC");
    expect(hidden(doc.querySelector(".mini-product-card__reference-price"))).toBe(true);
  });
});

describe("revisión v5: tarjeta", () => {
  it("2x1: el precio grande dice 'c/u llevando 2' y la fila de unidad no lo repite", async () => {
    const { doc, send } = setup(offerCard(K(1)));
    send({ type: "labels", labels: { [K(1)]: L(28000, { take: 2, price: 196, list: 392, offerText: "2x1" }) } });
    await tick();
    expect(doc.querySelector(".coto-unit-detail").textContent).toBe("c/u llevando 2");
    expect(doc.querySelector(".coto-unit-unit .coto-unit-why")).toBeNull();
  });

  it("Comunidad y 1 pago se dicen al lado del precio grande; el banco, en la fila de unidad", async () => {
    const { doc, send } = setup(comunidadCard(K(1)) + offerCard(K(2)));
    send({ type: "settings", selected: [{ id: "1" }], day: new Date().getDay() });
    send({ type: "labels", labels: {
      [K(1)]: L(711.1, { group: "L", price: 1599.99, list: 1999.99, via: "comunidad" }),
      [K(2)]: L(700, { group: "L", via: "1pago" }),
    } });
    await tick();
    const [a, b] = doc.querySelectorAll(".coto-unit-price");
    expect(a.querySelector(".coto-unit-detail").textContent).toBe("con Comunidad");
    expect(a.querySelector(".coto-unit-why")).toBeNull();
    expect(b.querySelector(".coto-unit-detail").textContent).toBe("en 1 pago");
  });

  it("el precio tachado tiene etiqueta para lectores de pantalla", async () => {
    const { doc, send } = setup(offerCard(K(1)));
    send({ type: "labels", labels: { [K(1)]: L(733.33) } });
    await tick();
    expect(doc.querySelector(".coto-unit-pricerow .coto-unit-sr").textContent).toBe("Precio original:");
  });

  it("un nodo reusado sin 'sin impuestos' pierde el atenuado", async () => {
    const { doc, send } = setup(offerCard(K(1)));
    send({ type: "labels", labels: { [K(1)]: L(733.33) } });
    await tick();
    const tax = [...doc.querySelectorAll("small")].find((s) => /sin impuestos/.test(s.textContent));
    tax.textContent = "Otro texto";
    await tick();
    expect(tax.hasAttribute("data-coto-unit-dim")).toBe(false);
  });

  it("no oculta un bloque que tiene el nombre o un link", async () => {
    const html = offerCard(K(1)).replace('<div class="w-100"></div>', '<div class="extra"><a href="#">Ver</a> Precio por 1 Litro: $1</div>');
    const { doc, send } = setup(html);
    send({ type: "labels", labels: { [K(1)]: L(733.33) } });
    await tick();
    expect(hidden(doc.querySelector(".extra"))).toBe(false);
  });

  it("en búsquedas y ofertas dice 'de esta lista'; al cambiar de página se borra", async () => {
    const { win, doc, send } = setup(offerCard(K(1)));
    send({ type: "labels", labels: { [K(1)]: L(733.33) } });
    send({ type: "best", best: { [K(1)]: "kg" }, scope: "lista", seq: 1 });
    await tick();
    expect(doc.querySelector(".coto-unit-best").textContent).toBe("Más barato de esta lista");
    win.location = { pathname: "/productos/categorias/otra" };
    doc.body.append(doc.createElement("span"));
    await tick();
    expect(doc.querySelector(".coto-unit-best")).toBeNull();
  });

  it("al cambiar Comunidad se borran las etiquetas viejas y la PDP pide de nuevo", async () => {
    const key = "_/R-00621756-00621756-200";
    const { win, doc, send } = setup(`<div class="mt-4"><div><var class="price">$1</var></div></div>`, `/productos/x/${key}`);
    send({ type: "settings", selected: [], day: 1 });
    send({ type: "labels", labels: { [key]: L(10, { via: "comunidad" }) } });
    await tick();
    expect(doc.querySelector(".coto-unit-box")).not.toBeNull();
    const lookups = win.posted.filter((m) => m.type === "lookup").length;
    send({ type: "settings", selected: [], day: 1, comunidad: false });
    await tick();
    expect(doc.querySelector(".coto-unit-box")).toBeNull();
    expect(win.posted.filter((m) => m.type === "lookup").length).toBe(lookups + 1);
  });
});

describe("v6: etiquetas en la imagen y detalle", () => {
  it("el más barato va arriba de todo en la imagen", async () => {
    const { doc, send } = setup(offerCard(K(1)));
    send({ type: "labels", labels: { [K(1)]: L(733.33) } });
    send({ type: "best", best: { [K(1)]: "kg" }, seq: 1 });
    await tick();
    const tags = doc.querySelector(".top-imagen-promos .coto-unit-tags");
    expect([...tags.children].map((c) => c.className)).toEqual(["coto-unit-best", "coto-unit-offer"]);
    expect(doc.querySelector(".coto-unit-price .coto-unit-best")).toBeNull();
  });

  it("las notas de medida van en el detalle, junto a la condición", async () => {
    const { doc, send } = setup(offerCard(K(1)));
    send({ type: "labels", labels: { [K(1)]: L(733.33, { take: 2, drained: true }) } });
    await tick();
    expect(doc.querySelector(".coto-unit-detail").textContent).toBe("c/u llevando 2 · escurrido");
  });

  it("la marca de grupo también va en la imagen", async () => {
    const { doc, send } = setup(plainCard(K(1)).replace('<a href', '<div class="top-imagen-promos"><div class="promos"></div></div><a href'));
    send({ type: "labels", labels: { [K(1)]: L(1, { offerText: null }) }, marks: { [K(1)]: "kg" }, seq: 1 });
    await tick();
    expect(doc.querySelector(".coto-unit-tags .coto-unit-mark").textContent).toBe("▸ Por kilo");
  });
});

describe("revisión v5: PDP", () => {
  it("una línea con 'Precio regular' y 'Precio por 1' no se oculta entera", async () => {
    const key = "_/R-00621756-00621756-200";
    const html = `<div class="mt-4"><div><var class="price">$100</var></div><div class="both">Precio regular: $150 · Precio por 1 Kilo: $300</div></div>`;
    const { doc, send } = setup(html, `/productos/x/${key}`);
    send({ type: "labels", labels: { [key]: L(10) } });
    await tick();
    expect(hidden(doc.querySelector(".both"))).toBe(false);
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
    // Como el cliente real: un lote entero se resuelve de una vez.
    async resolveAll(eans, res) {
      for (const e of eans) done.set(e, res);
      for (const e of eans) waiting.get(e)?.(res);
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
    const box = doc.querySelector(".coto-unit-cmprow");
    expect(box.getAttribute("data-coto-unit-ean")).toBe(EAN_A);
    expect(box.lastElementChild.classList.contains("coto-unit-cmp")).toBe(true);
    expect(prices(doc)).toEqual(["$2.225", "…", "…", "…"]);
    send({ type: "labels", labels: { [K(1)]: L(5177, { ean: EAN_A, cmp: CMP }) } });
    await tick();
    expect(compare.asked).toEqual([EAN_A]);
    await compare.resolve(EAN_A, RES);
    expect(prices(doc)).toEqual(["$2.225", "$2.049", "$1.899", "$2.229"]);
    expect(doc.querySelector(".coto-unit-cmp").dataset.state).toBe("worse");
    expect(doc.querySelector(".coto-unit-cmp-qty").textContent).toBe("x2");
    expect(compare.asked).toEqual([EAN_A]);
  });

  it("sin EAN no hay bloque ni pedido", async () => {
    const compare = fakeCompare();
    const { doc, send } = setup(offerCard(K(1)), undefined, { compare });
    send({ type: "labels", labels: { [K(1)]: L(5177, { ean: null, cmp: null }) } });
    await tick();
    expect(doc.querySelector(".coto-unit-price")).not.toBeNull();
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
    expect(prices(doc)[2]).toBe("$1.899");
    send({ type: "labels", labels: { [K(1)]: L(5177, { ean: EAN_B, cmp: CMP }) } });
    await tick();
    expect(doc.querySelector(".coto-unit-cmprow").getAttribute("data-coto-unit-ean")).toBe(EAN_B);
    expect(prices(doc)).toEqual(["$2.225", "…", "…", "…"]);
    await compare.resolve(EAN_B, { carrefour: "missing", dia: { unit: 2600, qty: 1, promo: null }, mas: "missing" });
    expect(prices(doc)).toEqual(["$2.225", "No está", "$2.600", "No está"]);
    expect(doc.querySelector(".coto-unit-cmp").dataset.state).toBe("better");
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
    expect(doc.querySelectorAll(".coto-unit-price")).toHaveLength(2);
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
    const box = doc.querySelector(".coto-unit-cmprow");
    expect(prices(doc)).toEqual(["$2.225", "…", "…", "…"]);
    expect(compare.asked).toEqual([]);
    expect(observers[0].targets.has(box)).toBe(true);
    observers[0].show(box);
    observers[0].show(box);
    send({ type: "labels", labels: { [K(1)]: L(5177, { ean: EAN_A, cmp: CMP }) } });
    await tick();
    expect(compare.asked).toEqual([EAN_A]);
    expect(observers[0].targets.has(box)).toBe(false);
  });

  // Sin el observador de la página, para contar solo los repintados por respuestas.
  class NoMO {
    observe() {}
    disconnect() {}
  }
  // Cuenta pasadas de render: cada una recorre los links de tarjetas una vez.
  function countPasses(doc) {
    const counter = { n: 0 };
    const qsa = doc.querySelectorAll.bind(doc);
    doc.querySelectorAll = (sel) => {
      if (sel === 'a[href*="_/R-"]') counter.n++;
      return qsa(sel);
    };
    return counter;
  }

  it("un lote de 3 EAN que llega junto repinta una sola vez", async () => {
    const compare = fakeCompare();
    const EAN_C = "7790070318237";
    const { doc, send } = setup(offerCard(K(1)) + offerCard(K(2)) + offerCard(K(3)), undefined, { compare, MutationObserver: NoMO });
    send({
      type: "labels",
      labels: { [K(1)]: L(5177, { ean: EAN_A, cmp: CMP }), [K(2)]: L(10, { ean: EAN_B, cmp: CMP }), [K(3)]: L(20, { ean: EAN_C, cmp: CMP }) },
    });
    await tick();
    expect(compare.asked).toEqual([EAN_A, EAN_B, EAN_C]);
    const passes = countPasses(doc);
    await compare.resolveAll([EAN_A, EAN_B, EAN_C], RES);
    expect(passes.n).toBe(1);
    expect(prices(doc)).toEqual(Array(3).fill(["$2.225", "$2.049", "$1.899", "$2.229"]).flat());
  });

  it("un lote que llega con la comparación apagada no repinta", async () => {
    const compare = fakeCompare();
    const { doc, send } = setup(offerCard(K(1)) + offerCard(K(2)), undefined, { compare, MutationObserver: NoMO });
    send({ type: "labels", labels: { [K(1)]: L(5177, { ean: EAN_A, cmp: CMP }), [K(2)]: L(10, { ean: EAN_B, cmp: CMP }) } });
    await tick();
    send({ type: "settings", selected: [], day: 1, compareStores: false });
    const passes = countPasses(doc);
    await compare.resolveAll([EAN_A, EAN_B], RES);
    expect(passes.n).toBe(0);
    expect(doc.querySelector(".coto-unit-cmp")).toBeNull();
  });
  it("en la tarjeta, la pastilla va en su fila debajo del precio, antes del precio por unidad", async () => {
    const compare = fakeCompare();
    const { doc, send } = setup(offerCard(K(1)), undefined, { compare });
    send({ type: "labels", labels: { [K(1)]: L(5177, { ean: EAN_A, cmp: CMP }) } });
    await tick();
    const block = doc.querySelector(".coto-unit-price");
    expect([...block.children].map((c) => c.className)).toEqual(["coto-unit-pricerow", "coto-unit-detail", "coto-unit-cmprow", "coto-unit-unit"]);
    await compare.resolve(EAN_A, RES);
    const row = block.querySelector(".coto-unit-cmprow");
    expect(row.lastElementChild.classList.contains("coto-unit-cmp--icon")).toBe(true);
    expect(row.querySelector(".coto-unit-cmp-btn")).not.toBeNull();
    expect(doc.querySelector(".coto-unit-box")).toBeNull();
  });

  it("página de producto: el mismo ícono con el detalle, al final de la caja", async () => {
    const key = "_/R-00621756-00621756-200";
    const compare = fakeCompare();
    const html = `<div class="mt-4"><div><var class="price">$100</var></div><div class="mt-2 small">Precio regular: $150</div></div>`;
    const { doc, send } = setup(html, `/productos/x/${key}`, { compare });
    send({ type: "labels", labels: { [key]: L(10, { ean: EAN_A, cmp: CMP }) } });
    await tick();
    await compare.resolve(EAN_A, RES);
    const box = doc.querySelector(".coto-unit-box--pdp");
    expect(box.lastElementChild.classList.contains("coto-unit-cmp--icon")).toBe(true);
    expect(prices(doc)).toEqual(["$2.225", "$2.049", "$1.899", "$2.229"]);
  });

  it("carrusel: una sola línea con el mejor precio de otro súper", async () => {
    const compare = fakeCompare();
    const html = `<div class="mini-product-card" data-cnstrc-item-id="prod1"><div class="mini-product-card__price-section"></div></div>`;
    const { doc, send } = setup(html, undefined, { compare });
    send({ type: "labels", labels: { prod1: L(10, { ean: EAN_A, cmp: CMP }) } });
    await tick();
    await compare.resolve(EAN_A, RES);
    const box = doc.querySelector(".coto-unit-box--mini");
    expect(box.lastElementChild.className).toBe("coto-unit-cmp");
    expect(box.querySelector(".coto-unit-cmp-best").textContent).toBe("Día $1.899 ▼ (x2)");
  });
});

describe("v7: logos de bancos", () => {
  const logoUrl = (n) => (n ? "https://x/" + n : null);
  function setupLogo(html, path) {
    const win = new EventTarget();
    win.location = { pathname: path ?? "/productos/categorias/x" };
    win.posted = [];
    win.postMessage = (m) => win.posted.push(m);
    win.MutationObserver = window.MutationObserver;
    const doc = document.implementation.createHTMLDocument("x");
    doc.body.innerHTML = html;
    installBadges(win, doc, { logoUrl });
    const send = (data) => win.dispatchEvent(new MessageEvent("message", { data: { source: "coto-unit", ...data } }));
    return { doc, send };
  }

  it("la tarjeta muestra el logo del banco en el motivo", async () => {
    const { doc, send } = setupLogo(plainCard(K(1)));
    send({ type: "settings", selected: [{ id: "1" }], day: new Date().getDay() });
    send({ type: "labels", labels: { [K(1)]: L(933, { group: "L", bankValue: 653, bankName: "ICBC", bankLogo: "logo_icbc_1.png", bankPrice: 1960, bankPercent: 30, price: 2800, list: 2800, offerText: null }) } });
    await tick();
    const detail = doc.querySelector(".coto-unit-detail");
    expect(detail.querySelector("img.coto-unit-logo").getAttribute("src")).toBe("https://x/logo_icbc_1.png");
    expect(detail.querySelector("img").getAttribute("alt")).toBe("ICBC");
    expect(detail.textContent).toBe("con  30% hoy");
  });

  it("sin logo sigue el texto", async () => {
    const { doc, send } = setupLogo(plainCard(K(1)));
    send({ type: "settings", selected: [{ id: "1" }], day: new Date().getDay() });
    send({ type: "labels", labels: { [K(1)]: L(933, { group: "L", bankValue: 653, bankName: "ICBC", bankLogo: null, bankPrice: 1960, bankPercent: 30, price: 2800, list: 2800, offerText: null }) } });
    await tick();
    expect(doc.querySelector(".coto-unit-detail img")).toBeNull();
    expect(doc.querySelector(".coto-unit-detail").textContent).toBe("con ICBC 30% hoy");
  });

  it("en el carrusel, solo el logo", async () => {
    const html = `<div class="mini-product-card" data-cnstrc-item-id="prod1"><div class="mini-product-card__price-section"></div></div>`;
    const { doc, send } = setupLogo(html);
    send({ type: "labels", labels: { prod1: L(189, { group: "rollo10m", bankValue: 133, bankName: "ICBC", bankLogo: "logo_icbc_1.png" }) } });
    await tick();
    const why = doc.querySelector(".coto-unit-box--mini .coto-unit-why");
    expect(why.querySelector("img")).not.toBeNull();
    expect(why.textContent.trim()).toBe("");
    expect(why.getAttribute("aria-label")).toBe("ICBC");
  });
});

describe("v8: etiquetas para vos en la tarjeta", () => {
  const MILK = { allergens: ["milk"], traces: [], per100: {} };
  // nutrition de prueba: perfil fijo, resultados que llegan cuando el test lo decide.
  function fakeNutrition(profile, results = {}) {
    const n = {
      asked: [],
      profile,
      results: { ...results },
      wantsCards: () => Boolean(n.profile.celiac || n.profile.allergens?.length),
      request: (ean) => { n.asked.push(ean); },
      cardTags: (label) => {
        const r = n.results[label.ean];
        if (r === undefined) return undefined;
        const mine = n.profile.allergens ?? [];
        if (r === "error") return mine.length ? [["unknown", "Alergias: sin dato"]] : [];
        return mine.filter((k) => r.allergens?.includes(k)).map(() => ["danger", "Tiene leche"]);
      },
      paint: () => {},
    };
    return n;
  }
  const two = () => offerCard(K(1)) + offerCard(K(2));
  const food = (ean) => L(5177, { ean, nutri: true });
  const labels = (a = food(EAN_A), b = food(EAN_B)) => ({ [K(1)]: a, [K(2)]: b });
  const tagsOf = (doc) => [...doc.querySelectorAll(".coto-unit-foryou")];
  const skin = (doc, kind) => (kind ? doc.documentElement.setAttribute("data-gondola-skin", kind) : doc.documentElement.removeAttribute("data-gondola-skin"));

  it("perfil vacío: no se pide nada y no hay etiquetas", async () => {
    const nutrition = fakeNutrition({ celiac: false, allergens: [] });
    const { doc, send } = setup(two(), undefined, { nutrition });
    skin(doc, "list");
    send({ type: "labels", labels: labels() });
    await tick();
    expect(nutrition.asked).toEqual([]);
    expect(tagsOf(doc)).toHaveLength(0);
  });

  it("con alergia a la leche: pide cada EAN una vez y pinta la etiqueta al llegar", async () => {
    const nutrition = fakeNutrition({ celiac: false, allergens: ["milk"] });
    const { doc, send } = setup(two(), undefined, { nutrition });
    skin(doc, "list");
    send({ type: "labels", labels: labels() });
    await tick();
    send({ type: "labels", labels: labels() });
    await tick();
    expect(nutrition.asked).toEqual([EAN_A, EAN_B]);
    expect(tagsOf(doc)).toHaveLength(0);
    nutrition.results[EAN_A] = MILK;
    send({ type: "labels", labels: labels() });
    await tick();
    const [box] = tagsOf(doc);
    expect(tagsOf(doc)).toHaveLength(1);
    expect(box.getAttribute("data-coto-unit-ean")).toBe(EAN_A);
    expect(box.closest(".top-imagen-promos")).not.toBeNull();
    expect(box.querySelector(".coto-unit-foryou-danger").textContent).toBe("Tiene leche");
  });

  it("con IntersectionObserver pide cuando la tarjeta se ve, una sola vez", async () => {
    const observers = [];
    class FakeIO {
      constructor(cb) { this.cb = cb; this.targets = new Set(); observers.push(this); }
      observe(t) { this.targets.add(t); }
      unobserve(t) { this.targets.delete(t); }
      disconnect() { this.targets.clear(); }
      show(t) { this.cb([{ target: t, isIntersecting: true }], this); }
    }
    const nutrition = fakeNutrition({ celiac: false, allergens: ["milk"] });
    const { doc, send } = setup(two(), undefined, { nutrition, IntersectionObserver: FakeIO });
    skin(doc, "list");
    send({ type: "labels", labels: labels() });
    await tick();
    expect(nutrition.asked).toEqual([]);
    const cards = [...doc.querySelectorAll(".card-container")];
    expect(cards.every((c) => observers[0].targets.has(c))).toBe(true);
    observers[0].show(cards[0]);
    observers[0].show(cards[0]);
    send({ type: "labels", labels: labels() });
    await tick();
    expect(nutrition.asked).toEqual([EAN_A]);
  });

  it("producto que no es comida: no se pide", async () => {
    const nutrition = fakeNutrition({ celiac: false, allergens: ["milk"] });
    const { doc, send } = setup(two(), undefined, { nutrition });
    skin(doc, "list");
    send({ type: "labels", labels: labels(L(5177, { ean: EAN_A, nutri: false }), food(EAN_B)) });
    await tick();
    expect(nutrition.asked).toEqual([EAN_B]);
  });

  it("sin la piel de la lista: no se pide nada y no hay etiquetas", async () => {
    const nutrition = fakeNutrition({ celiac: false, allergens: ["milk"] }, { [EAN_A]: MILK });
    for (const kind of [null, "pdp"]) {
      const { doc, send } = setup(two(), undefined, { nutrition });
      skin(doc, kind);
      send({ type: "labels", labels: labels() });
      await tick();
      expect(tagsOf(doc)).toHaveLength(0);
    }
    expect(nutrition.asked).toEqual([]);
  });

  it("si Open Food Facts falla: dice 'sin dato' y no reintenta en los repintados", async () => {
    const nutrition = fakeNutrition({ celiac: false, allergens: ["milk"] });
    const { doc, send } = setup(offerCard(K(1)), undefined, { nutrition });
    skin(doc, "list");
    send({ type: "labels", labels: { [K(1)]: food(EAN_A) } });
    await tick();
    nutrition.results[EAN_A] = "error";
    for (let i = 0; i < 3; i++) {
      send({ type: "labels", labels: { [K(1)]: food(EAN_A) } });
      await tick();
    }
    expect(tagsOf(doc)).toHaveLength(1);
    expect(doc.querySelector(".coto-unit-foryou-unknown").textContent).toBe("Alergias: sin dato");
    expect(nutrition.asked).toEqual([EAN_A]);
  });

  it("la tarjeta pasa a otro producto: pierde las etiquetas del anterior en el mismo repintado", async () => {
    const nutrition = fakeNutrition({ celiac: false, allergens: ["milk"] }, { [EAN_A]: MILK });
    const { doc, send } = setup(offerCard(K(1)), undefined, { nutrition });
    skin(doc, "list");
    send({ type: "labels", labels: { [K(1)]: food(EAN_A), [K(2)]: food(EAN_B) } });
    await tick();
    expect(tagsOf(doc)).toHaveLength(1);
    doc.querySelector('a[href*="_/R-"]').setAttribute("href", `/productos/x/${K(2)}`);
    await tick();
    expect(tagsOf(doc)).toHaveLength(0);
    expect(nutrition.asked).toEqual([EAN_B]);
  });

  it("apagar la piel y repintar saca las etiquetas; prenderla las vuelve a poner", async () => {
    const nutrition = fakeNutrition({ celiac: false, allergens: ["milk"] }, { [EAN_A]: MILK });
    const { doc, send } = setup(offerCard(K(1)), undefined, { nutrition });
    skin(doc, "list");
    send({ type: "labels", labels: { [K(1)]: food(EAN_A) } });
    await tick();
    expect(tagsOf(doc)).toHaveLength(1);
    skin(doc, null);
    send({ type: "settings", selected: [], day: 1 });
    expect(tagsOf(doc)).toHaveLength(0);
    skin(doc, "list");
    send({ type: "settings", selected: [], day: 1 });
    expect(tagsOf(doc)).toHaveLength(1);
  });

  it("el perfil cambia y el repintado saca las etiquetas", async () => {
    const nutrition = fakeNutrition({ celiac: false, allergens: ["milk"] }, { [EAN_A]: MILK });
    const { doc, send } = setup(offerCard(K(1)), undefined, { nutrition });
    skin(doc, "list");
    send({ type: "labels", labels: { [K(1)]: food(EAN_A) } });
    await tick();
    expect(tagsOf(doc)).toHaveLength(1);
    nutrition.profile = { celiac: false, allergens: [] };
    send({ type: "settings", selected: [], day: 1 });
    expect(tagsOf(doc)).toHaveLength(0);
  });
});
