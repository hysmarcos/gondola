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

function setup(html, path = "/productos/categorias/x") {
  const win = new EventTarget();
  win.location = { pathname: path };
  win.posted = [];
  win.postMessage = (m) => win.posted.push(m);
  win.MutationObserver = window.MutationObserver;
  const doc = document.implementation.createHTMLDocument("x");
  doc.body.innerHTML = html;
  installBadges(win, doc);
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
    expect([...block.children].map((c) => c.className)).toEqual(["coto-unit-pricerow", "coto-unit-detail", "coto-unit-unit"]);
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
    send({ type: "labels", labels: { [K(1)]: L(933.33, { group: "L", bankValue: 653.33, bankName: "ICBC", price: 2800, list: 2800, offerText: null }) } });
    await tick();
    expect(doc.querySelector(".coto-unit-value").textContent).toBe("$653 /L");
    expect(doc.querySelector(".coto-unit-why").textContent).toBe("con ICBC hoy");
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
    expect(box.previousElementSibling.querySelector(".price")).not.toBeNull();
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
      [K(2)]: L(700, { group: "L", via: "1pago", bankValue: 490, bankName: "ICBC" }),
    } });
    await tick();
    const [a, b] = doc.querySelectorAll(".coto-unit-price");
    expect(a.querySelector(".coto-unit-detail").textContent).toBe("con Comunidad");
    expect(a.querySelector(".coto-unit-why")).toBeNull();
    expect(b.querySelector(".coto-unit-detail").textContent).toBe("en 1 pago");
    expect(b.querySelector(".coto-unit-why").textContent).toBe("con ICBC hoy");
  });

  it("el precio tachado tiene etiqueta para lectores de pantalla", async () => {
    const { doc, send } = setup(offerCard(K(1)));
    send({ type: "labels", labels: { [K(1)]: L(733.33) } });
    await tick();
    expect(doc.querySelector(".coto-unit-pricerow .coto-unit-sr").textContent).toBe("Precio regular:");
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
