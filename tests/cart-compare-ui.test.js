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

describe("paintCartCompare", () => {
  it("gana Día: respuesta, productos en común y diferencia", () => {
    const { box } = paint(winsDia());
    expect(box.textContent).toContain("Tu carrito en otros súper");
    expect(box.textContent).toContain("Hoy te conviene Día");
    expect(box.textContent).toContain("Pagás $3.150 menos");
    const d = block(box, "dia");
    expect(d.textContent).toContain("Día · 9 de 12 productos");
    expect(d.querySelector(".coto-unit-cc--down").textContent).toContain("$3.150 menos");
    expect(d.textContent).toContain("Sin banco");
    expect(d.textContent).toContain("$33.900 · Coto $37.050");
    expect(block(box, "mas").querySelector(".coto-unit-cc--up").textContent).toContain("$1.200 más");
  });

  it("dentro del 1%: casi igual", () => {
    const { box } = paint(cmpOf([mas({ other: 30200, diff: 200 })], { winner: "coto", saving: 0, withCards: false, runnerUp: "mas" }));
    expect(box.querySelector(".coto-unit-cc--eq").textContent).toContain("= casi igual");
    expect(box.textContent).toContain("Hoy te conviene Coto");
    expect(box.textContent).toContain("Sale casi lo mismo en todos");
  });

  it("con tarjetas: renglón con los dos totales y la respuesta contra el segundo", () => {
    const { box } = paint(cmpOf([dia(), mas()], { winner: "dia", saving: 1300, withCards: true, runnerUp: "coto" }), { cards: true });
    expect(box.textContent).toContain("Con tus tarjetas pagás $1.300 menos que en Coto");
    const d = block(box, "dia");
    expect(d.textContent).toContain("Con tus tarjetas (Naranja X 25%)");
    expect(d.textContent).toContain("$25.425 · Coto $23.025");
    expect(block(box, "mas").textContent).toContain("Sin promo de tus tarjetas hoy");
  });

  it("gana Coto con tarjetas: el segundo es el runnerUp del veredicto, sin recalcular", () => {
    const cmp = cmpOf([dia({ bankOther: { label: "X 10%", saving: 1, total: 24025 } }), mas()], { winner: "coto", saving: 1000, withCards: true, runnerUp: "mas" });
    const { box } = paint(cmp, { cards: true });
    expect(box.textContent).toContain("Con tus tarjetas pagás $1.000 menos que en Más");
  });

  it("sin tarjetas prendidas no va el renglón con tarjetas", () => {
    const { box } = paint(winsDia());
    expect(box.textContent).not.toContain("Con tus tarjetas");
  });

  it("bankNote min: cuánto falta para la compra mínima", () => {
    const { box } = paint(cmpOf([dia({ bankOther: null, bankNote: "min", minLeft: 69400 })], { winner: "dia", saving: 3150, withCards: true, runnerUp: "coto" }), { cards: true });
    expect(box.textContent).toContain("Te faltan $69.400 para la compra mínima");
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

  it("faltantes que están en el otro súper llevan su enlace", () => {
    const withUrl = [{ ean: "a", name: "Yerba Mañanita", url: "https://diaonline.supermercadosdia.com.ar/yerba/p" }, { ean: "b", name: "Fideos", url: null }];
    const { box } = paint(cmpOf([dia({ missing: withUrl })], { winner: null }));
    const items = [...block(box, "dia").querySelectorAll('[data-of="missing:dia"] li')];
    expect(items[0].querySelector("a").getAttribute("href")).toBe("https://diaonline.supermercadosdia.com.ar/yerba/p");
    expect(items[0].querySelector("a").textContent).toBe("Ver en Día");
    expect(items[1].querySelector("a")).toBeNull();
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

  it("productos en común: cada uno con su enlace al otro súper", () => {
    const { box } = paint(winsDia());
    button(block(box, "dia"), "Ver los 9 productos").click();
    const links = [...block(box, "dia").querySelectorAll('[data-of="common:dia"] a')];
    expect(links).toHaveLength(9);
    expect(links[0].textContent).toBe("Ver en Día");
    expect(links[0].getAttribute("href")).toBe("https://diaonline.supermercadosdia.com.ar/p1/p");
    expect(links[0].getAttribute("target")).toBe("_blank");
    expect(links[0].getAttribute("rel")).toBe("noopener");
  });

  it("enlace de otro sitio o sin https: no va", () => {
    const bad = [{ ...common(1)[0], url: "javascript:alert(1)" }, { ...common(1)[0], ean: "2", url: "https://otro.com/x" }];
    const { box } = paint(cmpOf([dia({ common: bad, matched: 2 })], { winner: null }));
    expect(block(box, "dia").querySelectorAll("a")).toHaveLength(0);
  });

  it("state error y empty", () => {
    const { box } = paint(cmpOf([{ id: "dia", name: "Día", state: "error" }, mas({ state: "empty", matched: 0, common: [] })], { winner: null }));
    expect(block(box, "dia").textContent).toBe("No pudimos consultar Día");
    expect(block(box, "mas").textContent).toBe("Más: ningún producto en común");
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
