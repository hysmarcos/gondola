// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { paintCartCompare, miniCartLine, paintMiniCompare } from "../src/cart-compare-ui.js";

const NOW = 1_700_000_000_000;
const MIN = 60_000;

const common = (n) => Array.from({ length: n }, (_, i) => ({
  ean: String(i + 1), name: `Producto ${i + 1}`, coto: 100, other: 90,
  url: `https://diaonline.supermercadosdia.com.ar/p${i + 1}/p`,
}));
const missing = [{ ean: "a", name: "Yerba Mañanita" }, { ean: "b", name: "Fideos Lucchetti" }, { ean: null, name: "Pan" }];

const dia = (extra = {}) => ({
  id: "dia", name: "Día", state: "ok", at: NOW - 5 * MIN, matched: 9, of: 12,
  common: common(9), missing, coto: 37050, other: 33900, diff: -3150,
  bankCoto: { label: "ICBC 20%", saving: 1500, total: 23025 },
  bankOther: { label: "Naranja X 25%", saving: 8475, total: 25425 },
  bankNote: null, minLeft: null, ...extra,
});
const mas = (extra = {}) => ({
  id: "mas", name: "Más", state: "ok", at: NOW - 2 * MIN, matched: 10, of: 12,
  common: [], missing: [], coto: 30000, other: 31200, diff: 1200,
  bankCoto: null, bankOther: null, bankNote: "none", minLeft: null, ...extra,
});
const cmpOf = (stores, verdict) => ({ stores, verdict });
const winsDia = () => cmpOf([dia(), mas()], { winner: "dia", saving: 3150, withCards: false, runnerUp: "coto" });

function paint(cmp, opts = {}) {
  const doc = document.implementation.createHTMLDocument("t");
  const box = doc.createElement("div");
  box.className = "coto-unit-cc";
  doc.body.append(box);
  paintCartCompare(doc, box, cmp, { now: NOW, ...opts });
  return { doc, box };
}
const block = (box, id) => box.querySelector(`[data-store="${id}"]`);
const button = (box, text) => [...box.querySelectorAll("button")].find((b) => b.textContent.includes(text));

const LOGOS = { coto: "ext://coto.png", dia: "ext://dia.png", mas: "ext://mas.png" };
const logo = (id) => LOGOS[id] ?? null;
// Las filas del desglose de un súper: [etiqueta, celda del súper, celda de Coto].
const sums = (node) => [...node.querySelectorAll("tfoot tr")].map((tr) => [...tr.children].map((c) => c.textContent));
const items = (node) => [...node.querySelectorAll(".coto-unit-cc-items tr")];

describe("paintCartCompare", () => {
  it("gana Día: respuesta, cabecera de cada súper y diferencia contra Coto", () => {
    const { box } = paint(winsDia());
    expect(box.querySelector("h2").textContent).toBe("Tu carrito en otros súper");
    expect(box.textContent).toContain("Hoy te conviene Día");
    expect(box.textContent).toContain("Pagás $3.150 menos");
    const d = block(box, "dia");
    expect(d.querySelector(".coto-unit-cc-name").textContent).toBe("Día");
    expect(d.querySelector(".coto-unit-cc-count").textContent).toBe("9 de 12 productos");
    expect(d.querySelector(".coto-unit-cc--down").textContent).toBe("$3.150 menos que en Coto");
    expect(sums(d)).toEqual([["Subtotal", "$33.900", "$37.050"]]);
    expect(block(box, "mas").querySelector(".coto-unit-cc--up").textContent).toBe("$1.200 más que en Coto");
  });

  it("cada súper es su propia sección, con su logo en la cabecera", () => {
    const { box } = paint(winsDia(), { logo });
    const sections = [...box.querySelectorAll("section.coto-unit-cc-store")];
    expect(sections.map((s) => s.dataset.store)).toEqual(["dia", "mas"]);
    expect(block(box, "dia").querySelector(".coto-unit-cc-head img").getAttribute("src")).toBe("ext://dia.png");
    expect(block(box, "mas").querySelector(".coto-unit-cc-head img").getAttribute("src")).toBe("ext://mas.png");
    // El logo del que gana, junto a la respuesta.
    expect(box.querySelector(".coto-unit-cc-verdict img").getAttribute("src")).toBe("ext://dia.png");
    // Las dos columnas de precio: el súper y Coto, cada una con su logo.
    const cols = [...block(box, "dia").querySelectorAll("thead th")].slice(1);
    expect(cols.map((c) => c.textContent)).toEqual(["Día", "Coto"]);
    expect(cols.map((c) => c.querySelector("img").getAttribute("src"))).toEqual(["ext://dia.png", "ext://coto.png"]);
  });

  it("sin logos no hay imágenes", () => {
    const { box } = paint(winsDia());
    expect(box.querySelectorAll("img")).toHaveLength(0);
  });

  it("dentro del 1%: casi igual", () => {
    const { box } = paint(cmpOf([mas({ other: 30200, diff: 200 })], { winner: "coto", saving: 0, withCards: false, runnerUp: "mas" }));
    expect(box.querySelector(".coto-unit-cc--eq").textContent).toBe("Casi igual que en Coto");
    expect(box.textContent).toContain("Hoy te conviene Coto");
    expect(box.textContent).toContain("Sale casi lo mismo en todos");
  });

  it("con tarjetas: el desglose resta la promo de cada lado y la diferencia es la del total", () => {
    const { box } = paint(cmpOf([dia(), mas()], { winner: "dia", saving: 1300, withCards: true, runnerUp: "coto" }), { cards: true });
    expect(box.textContent).toContain("Con tus tarjetas pagás $1.300 menos que en Coto");
    const d = block(box, "dia");
    expect(sums(d)).toEqual([
      ["Subtotal", "$33.900", "$37.050"],
      ["Tus tarjetas", "−$8.475Naranja X 25%", "−$1.500ICBC 20%"],
      ["Total", "$25.425", "$23.025"],
    ]);
    expect(d.querySelector(".coto-unit-cc-delta").textContent).toBe("$2.400 más que en Coto");
    expect(d.querySelector(".coto-unit-cc-note")).toBeNull();
    // Más no tiene promo de ningún lado: solo el subtotal y la nota.
    const m = block(box, "mas");
    expect(sums(m)).toEqual([["Subtotal", "$31.200", "$30.000"]]);
    expect(m.querySelector(".coto-unit-cc-note").textContent).toBe("Sin promo de tus tarjetas hoy");
  });

  it("promo solo en Coto: el otro súper lleva raya y el total usa su subtotal", () => {
    const st = mas({ bankCoto: { label: "ICBC 20%", saving: 6000, total: 24000 } });
    const { box } = paint(cmpOf([st], { winner: "coto", saving: 7200, withCards: true, runnerUp: "mas" }), { cards: true });
    expect(sums(block(box, "mas"))).toEqual([
      ["Subtotal", "$31.200", "$30.000"],
      ["Tus tarjetas", "—", "−$6.000ICBC 20%"],
      ["Total", "$31.200", "$24.000"],
    ]);
    expect(block(box, "mas").querySelector(".coto-unit-cc-delta").textContent).toBe("$7.200 más que en Coto");
  });

  it("gana Coto con tarjetas: el segundo es el runnerUp del veredicto, sin recalcular", () => {
    const cmp = cmpOf([dia({ bankOther: { label: "X 10%", saving: 1, total: 24025 } }), mas()], { winner: "coto", saving: 1000, withCards: true, runnerUp: "mas" });
    const { box } = paint(cmp, { cards: true });
    expect(box.textContent).toContain("Con tus tarjetas pagás $1.000 menos que en Más");
  });

  it("sin tarjetas prendidas no va el desglose con tarjetas", () => {
    const { box } = paint(winsDia());
    expect(box.textContent).not.toContain("Tus tarjetas");
    expect(box.querySelector(".coto-unit-cc-note")).toBeNull();
  });

  it("bankNote min: cuánto falta para la compra mínima", () => {
    const { box } = paint(cmpOf([dia({ bankOther: null, bankNote: "min", minLeft: 69400 })], { winner: "dia", saving: 3150, withCards: true, runnerUp: "coto" }), { cards: true });
    expect(block(box, "dia").querySelector(".coto-unit-cc-note").textContent).toBe("Te faltan $69.400 para la compra mínima");
  });

  it("bankNote changed y error", () => {
    const { box } = paint(cmpOf([dia({ bankOther: null, bankNote: "changed" }), mas({ bankNote: "error" })], { winner: null }), { cards: true });
    expect(block(box, "dia").textContent).toContain("Los términos cambiaron: no se resta");
    expect(block(box, "mas").textContent).toContain("No pudimos leer las promos");
  });

  it("sin súper que compitan: pocos productos en común", () => {
    const { box } = paint(cmpOf([dia()], { winner: null }));
    expect(box.textContent).toContain("Pocos productos en común para comparar");
    expect(box.textContent).not.toContain("Hoy te conviene");
  });

  it("faltantes: el botón abre la lista y un repintado con el mismo cmp la deja abierta", () => {
    const cmp = winsDia();
    const { doc, box } = paint(cmp);
    const btn = button(block(box, "dia"), "Faltan 3: ver cuáles");
    expect(btn.getAttribute("aria-expanded")).toBe("false");
    const list = () => block(box, "dia").querySelector('[data-of="missing:dia"]');
    expect(list().hidden).toBe(true);
    btn.click();
    expect(list().hidden).toBe(false);
    expect([...list().querySelectorAll("li")].map((li) => li.textContent)).toEqual(["Yerba Mañanita", "Fideos Lucchetti", "Pan"]);
    paintCartCompare(doc, box, cmp, { now: NOW });
    expect(list().hidden).toBe(false);
    // Un cmp nuevo (otra respuesta) rearma el bloque y la lista sigue abierta.
    paintCartCompare(doc, box, cmpOf([dia({ other: 33800, diff: -3250 }), mas()], cmp.verdict), { now: NOW });
    expect(list().hidden).toBe(false);
    expect(button(block(box, "dia"), "Faltan 3").getAttribute("aria-expanded")).toBe("true");
  });

  it("faltantes que están en el otro súper: el nombre es el enlace", () => {
    const withUrl = [{ ean: "a", name: "Yerba Mañanita", url: "https://diaonline.supermercadosdia.com.ar/yerba/p" }, { ean: "b", name: "Fideos", url: null }];
    const { box } = paint(cmpOf([dia({ missing: withUrl })], { winner: null }));
    const lis = [...block(box, "dia").querySelectorAll('[data-of="missing:dia"] li')];
    expect(lis[0].querySelector("a").getAttribute("href")).toBe("https://diaonline.supermercadosdia.com.ar/yerba/p");
    expect(lis[0].querySelector("a").textContent).toBe("Yerba Mañanita");
    expect(lis[1].querySelector("a")).toBeNull();
    expect(lis[1].textContent).toBe("Fideos");
  });

  it("con otro día de compra, la respuesta y la nota dicen ese día", () => {
    const cmp = cmpOf([dia(), mas()], { winner: "dia", saving: 3150, withCards: false, runnerUp: "coto" });
    const other = paint(cmp, { cards: true, day: 3, today: 1 }).box;
    expect(other.querySelector(".coto-unit-cc-answer").textContent).toBe("El miércoles te conviene Día");
    expect(block(other, "mas").textContent).toContain("Sin promo de tus tarjetas el miércoles");
    const same = paint(cmp, { cards: true, day: 1, today: 1 }).box;
    expect(same.querySelector(".coto-unit-cc-answer").textContent).toBe("Hoy te conviene Día");
    expect(block(same, "mas").textContent).toContain("Sin promo de tus tarjetas hoy");
  });

  it("productos en común: a la vista, el nombre es el enlace y los precios van a la derecha", () => {
    const { box } = paint(winsDia());
    const d = block(box, "dia");
    expect(d.querySelector('[data-of="common:dia"]').hidden).toBe(false);
    const rows = items(d);
    expect(rows).toHaveLength(9);
    const link = rows[0].querySelector("th a");
    expect(link.textContent).toBe("Producto 1");
    expect(link.getAttribute("href")).toBe("https://diaonline.supermercadosdia.com.ar/p1/p");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener");
    expect([...rows[0].querySelectorAll("td")].map((td) => td.textContent)).toEqual(["$90", "$100"]);
    expect(d.textContent).not.toContain("Ver en Día");
  });

  it("precio con oferta: el de lista va tachado antes del que se paga", () => {
    const list = [
      { ...common(1)[0], other: 90, otherList: 120 },
      { ...common(2)[1], other: 90, otherList: null },
      { ...common(3)[2], other: 90, otherList: 90 },
    ];
    const { box } = paint(cmpOf([dia({ common: list, matched: 3 })], { winner: null }));
    const cells = items(block(box, "dia")).map((tr) => tr.querySelector("td"));
    expect(cells[0].querySelector("s").textContent).toBe("$120");
    expect(cells[0].querySelector(".coto-unit-cc-amount").textContent).toBe("$90");
    expect(cells[0].firstElementChild.tagName).toBe("S");
    expect(cells[1].querySelector("s")).toBeNull();
    expect(cells[2].querySelector("s")).toBeNull();
  });

  it("se resalta el precio más barato de cada producto; casi igual, ninguno", () => {
    const list = [
      { ...common(1)[0], other: 90, coto: 100 },
      { ...common(2)[1], other: 130, coto: 100 },
      { ...common(3)[2], other: 100.5, coto: 100 },
    ];
    const { box } = paint(cmpOf([dia({ common: list, matched: 3 })], { winner: null }));
    const wins = items(block(box, "dia")).map((tr) => [...tr.querySelectorAll("td")].map((td) => td.classList.contains("coto-unit-cc-num--win")));
    expect(wins).toEqual([[true, false], [false, true], [false, false]]);
  });

  it("cantidad: se dice si se llevan varios", () => {
    const list = [{ ...common(1)[0], qty: 3 }, { ...common(2)[1], qty: 1 }];
    const { box } = paint(cmpOf([dia({ common: list, matched: 2 })], { winner: null }));
    const rows = items(block(box, "dia"));
    expect(rows[0].querySelector(".coto-unit-cc-qty").textContent).toBe("× 3");
    expect(rows[1].querySelector(".coto-unit-cc-qty")).toBeNull();
  });

  it("el desglose va debajo de los productos, en la misma tabla", () => {
    const { box } = paint(winsDia());
    const table = block(box, "dia").querySelector("table");
    expect([...table.children].map((c) => c.tagName)).toEqual(["THEAD", "TBODY", "TFOOT"]);
  });

  it("la lista de productos se puede ocultar y queda así al repintar", () => {
    const cmp = winsDia();
    const { doc, box } = paint(cmp);
    const btn = () => block(box, "dia").querySelector('[data-list="common:dia"]');
    const list = () => block(box, "dia").querySelector('[data-of="common:dia"]');
    expect(btn().textContent).toBe("Ocultar los 9 productos");
    expect(btn().getAttribute("aria-expanded")).toBe("true");
    btn().click();
    expect(list().hidden).toBe(true);
    expect(btn().textContent).toBe("Ver los 9 productos");
    expect(btn().getAttribute("aria-expanded")).toBe("false");
    paintCartCompare(doc, box, cmpOf([dia({ other: 33800, diff: -3250 }), mas()], cmp.verdict), { now: NOW });
    expect(list().hidden).toBe(true);
    expect(btn().textContent).toBe("Ver los 9 productos");
    // El desglose sigue a la vista.
    expect(sums(block(box, "dia"))).toEqual([["Subtotal", "$33.800", "$37.050"]]);
  });

  it("un solo producto en común: el botón lo dice en singular", () => {
    const { box } = paint(cmpOf([dia({ common: common(1), matched: 1 })], { winner: null }));
    expect(block(box, "dia").querySelector('[data-list="common:dia"]').textContent).toBe("Ocultar el producto");
  });

  it("enlace de otro sitio o sin https: no va", () => {
    const bad = [{ ...common(1)[0], url: "javascript:alert(1)" }, { ...common(1)[0], ean: "2", url: "https://otro.com/x" }];
    const { box } = paint(cmpOf([dia({ common: bad, matched: 2 })], { winner: null }));
    expect(block(box, "dia").querySelectorAll("a")).toHaveLength(0);
    expect(items(block(box, "dia"))[0].querySelector("th").textContent).toBe("Producto 1");
  });

  it("state error y empty", () => {
    const { box } = paint(cmpOf([{ id: "dia", name: "Día", state: "error" }, mas({ state: "empty", matched: 0, common: [] })], { winner: null }));
    expect(block(box, "dia").querySelector(".coto-unit-cc-off").textContent).toBe("No pudimos consultar Día");
    expect(block(box, "mas").querySelector(".coto-unit-cc-off").textContent).toBe("Más: ningún producto en común");
    expect(block(box, "dia").querySelector("table")).toBeNull();
  });

  it("dos llamadas seguidas con el mismo cmp no tocan el DOM", () => {
    const cmp = winsDia();
    const { doc, box } = paint(cmp);
    const first = box.firstChild;
    const records = [];
    const mo = new MutationObserver((r) => records.push(...r));
    mo.observe(box, { childList: true, subtree: true, attributes: true, characterData: true });
    paintCartCompare(doc, box, cmp, { now: NOW });
    paintCartCompare(doc, box, winsDia(), { now: NOW + 10_000 });
    expect(box.firstChild).toBe(first);
    expect(mo.takeRecords()).toHaveLength(0);
    mo.disconnect();
  });

  it("pie: antigüedad del precio más viejo y Actualizar llama a onRefresh una vez", () => {
    const onRefresh = vi.fn();
    const { box } = paint(winsDia(), { onRefresh });
    expect(box.textContent).toContain("Precios online de hace 5 min, sin envío");
    button(box, "Actualizar").click();
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it("pie: menos de un minuto es recién", () => {
    const { box } = paint(cmpOf([dia({ at: NOW - 30_000 })], { winner: null }));
    expect(box.textContent).toContain("Precios online recién consultados, sin envío");
  });
});

describe("miniCartLine", () => {
  it("gana otro súper", () => {
    expect(miniCartLine(winsDia())).toBe("Día: $3.150 menos en 9 de 12");
  });
  it("gana Coto", () => {
    expect(miniCartLine(cmpOf([mas()], { winner: "coto", saving: 0, withCards: false, runnerUp: "mas" }))).toBe("Coto es el más barato");
  });
  it("paintMiniCompare: espera, respuesta y pocos en común en la misma fila", () => {
    const doc = document.implementation.createHTMLDocument("t");
    const box = doc.createElement("div");
    doc.body.append(box);
    paintMiniCompare(doc, box, null);
    const row = box.querySelector(".coto-unit-cc-mini");
    expect(row.textContent).toBe("Comparando con otros súper…");
    expect(row.classList.contains("coto-unit-cc-mini--wait")).toBe(true);
    paintMiniCompare(doc, box, winsDia());
    expect(box.querySelector(".coto-unit-cc-mini")).toBe(row);
    expect(row.textContent).toBe("Día: $3.150 menos en 9 de 12");
    expect(row.classList.contains("coto-unit-cc-mini--wait")).toBe(false);
    paintMiniCompare(doc, box, cmpOf([mas()], { winner: null }));
    expect(box.querySelector(".coto-unit-cc-mini")).toBe(row);
    expect(row.textContent).toBe("Pocos productos en común para comparar");
  });

  it("sin respuesta", () => {
    expect(miniCartLine(cmpOf([mas()], { winner: null }))).toBeNull();
    expect(miniCartLine(null)).toBeNull();
  });
});
