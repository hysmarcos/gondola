// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { compareRows, paintCompare } from "../src/compare-ui.js";

const CMP = { unit: 2225, qty: 1 };
const RESULTS = {
  carrefour: { unit: 2049, qty: 1, promo: null },
  dia: { unit: 1899, qty: 2, promo: "x" },
  mas: { unit: 2229, qty: 1, promo: null },
};

function box() {
  const b = document.createElement("div");
  b.className = "coto-unit-box";
  b.innerHTML = `<div class="coto-unit-value">$2.225 /kg</div>`;
  return b;
}

describe("compareRows", () => {
  it("clasifica cada súper contra Coto", () => {
    const rows = compareRows(CMP, RESULTS);
    expect(rows.map((r) => r.id)).toEqual(["carrefour", "dia", "mas"]);
    expect(rows.map((r) => r.state)).toEqual(["lower", "lower", "equal"]);
    expect(rows[1]).toMatchObject({ name: "Día", unit: 1899, qty: 2, title: null });
  });

  it("sin dato: no está, no se pudo consultar, o todavía no llegó", () => {
    const rows = compareRows(CMP, { carrefour: { unit: 2600, qty: 1 }, dia: "missing" });
    expect(rows[0].state).toBe("higher");
    expect(rows[1]).toMatchObject({ state: "none", title: "No está en Día", unit: null });
    expect(rows[2]).toMatchObject({ state: "none", title: "No se pudo consultar Más" });
    expect(compareRows(CMP, { mas: "error" })[2].title).toBe("No se pudo consultar Más");
    expect(compareRows(CMP, undefined).map((r) => r.state)).toEqual(["pending", "pending", "pending"]);
  });

  it("un precio muy lejos del de Coto es dato dudoso", () => {
    const rows = compareRows({ unit: 3000, qty: 1 }, { carrefour: { unit: 300, qty: 1 }, dia: { unit: 8000, qty: 1 }, mas: { unit: 1200, qty: 1 } });
    expect(rows[0]).toMatchObject({ state: "none", title: "Dato dudoso", unit: null });
    expect(rows[1]).toMatchObject({ state: "none", title: "Dato dudoso" });
    expect(rows[2].state).toBe("lower"); // 0,4 justo: todavía vale
  });
});

describe("paintCompare", () => {
  it("una fila por súper con ícono, precio y 'llevando'", () => {
    const b = box();
    paintCompare(b, compareRows(CMP, { ...RESULTS, mas: { unit: 2600, qty: 1 } }), "");
    const block = b.lastElementChild;
    expect(block.className).toBe("coto-unit-cmp");
    const rows = [...block.querySelectorAll(".coto-unit-cmp-row")];
    expect(rows).toHaveLength(3);
    expect(rows[1].classList.contains("coto-unit-cmp-row--lower")).toBe(true);
    expect(rows[1].textContent).toContain("Día");
    expect(rows[1].querySelector(".coto-unit-cmp-price").textContent).toBe("▼ $1.899");
    expect(rows[1].getAttribute("aria-label")).toBe("Día: $1.899, más barato");
    expect(rows[2].querySelector(".coto-unit-cmp-price").textContent).toBe("▲ $2.600");
    expect(rows[2].getAttribute("aria-label")).toBe("Más: $2.600, más caro");
    const qty = block.querySelectorAll(".coto-unit-cmp-qty");
    expect(qty).toHaveLength(1);
    expect(qty[0].textContent).toBe("llevando 2");
  });

  it("igual, sin dato y esperando", () => {
    const b = box();
    paintCompare(b, compareRows(CMP, { carrefour: "missing", mas: RESULTS.mas }), "pdp");
    const rows = [...b.querySelectorAll(".coto-unit-cmp-row")];
    expect(rows[0].classList.contains("coto-unit-cmp-row--none")).toBe(true);
    expect(rows[0].querySelector(".coto-unit-cmp-price").textContent).toBe("—");
    expect(rows[0].getAttribute("title")).toBe("No está en Carrefour");
    expect(rows[2].querySelector(".coto-unit-cmp-price").textContent).toBe("= $2.229");
    expect(rows[2].getAttribute("aria-label")).toBe("Más: $2.229, igual");
    expect(rows[2].hasAttribute("title")).toBe(false);
    paintCompare(b, compareRows(CMP, undefined), "");
    expect([...b.querySelectorAll(".coto-unit-cmp-price")].map((p) => p.textContent)).toEqual(["…", "…", "…"]);
  });

  it("carrusel: solo el más barato, o Coto", () => {
    const b = box();
    paintCompare(b, compareRows(CMP, RESULTS), "mini");
    const best = b.querySelector(".coto-unit-cmp-best");
    expect(b.querySelectorAll(".coto-unit-cmp-row")).toHaveLength(0);
    // Día solo es más barato llevando 2: se dice, para no mentir con el precio.
    expect(best.textContent).toBe("Día $1.899 ▼ (x2)");
    expect(best.getAttribute("aria-label")).toBe("Día: $1.899, más barato, llevando 2");
    expect(best.classList.contains("coto-unit-cmp-best--lower")).toBe(true);
    paintCompare(b, compareRows(CMP, { ...RESULTS, dia: "missing" }), "mini");
    expect(b.querySelector(".coto-unit-cmp-best").textContent).toBe("Carrefour $2.049 ▼");
    expect(b.querySelector(".coto-unit-cmp-best").getAttribute("aria-label")).toBe("Carrefour: $2.049, más barato");
    paintCompare(b, compareRows(CMP, { carrefour: { unit: 2600, qty: 1 }, dia: "missing", mas: RESULTS.mas }), "mini");
    expect(b.querySelector(".coto-unit-cmp-best").textContent).toBe("Coto el más barato");
    expect(b.querySelector(".coto-unit-cmp-best").classList.contains("coto-unit-cmp-best--higher")).toBe(true);
    paintCompare(b, compareRows(CMP, undefined), "mini");
    expect(b.querySelector(".coto-unit-cmp-best").textContent).toBe("…");
    paintCompare(b, compareRows(CMP, { carrefour: "missing", dia: "error" }), "mini");
    expect(b.querySelector(".coto-unit-cmp")).toBeNull();
  });

  it("sin filas borra el bloque; queda último aunque Coto agregue algo", () => {
    const b = box();
    paintCompare(b, compareRows(CMP, RESULTS), "");
    const extra = document.createElement("div");
    b.appendChild(extra);
    paintCompare(b, compareRows(CMP, RESULTS), "");
    expect(b.lastElementChild.className).toBe("coto-unit-cmp");
    paintCompare(b, [], "");
    expect(b.querySelector(".coto-unit-cmp")).toBeNull();
    paintCompare(b, null, "");
    expect(b.querySelector(".coto-unit-cmp")).toBeNull();
  });

  it("pintar dos veces lo mismo no toca el DOM", async () => {
    const b = box();
    document.body.appendChild(b);
    paintCompare(b, compareRows(CMP, RESULTS), "");
    const records = [];
    const mo = new MutationObserver((r) => records.push(...r));
    mo.observe(b, { childList: true, subtree: true, attributes: true, characterData: true });
    paintCompare(b, compareRows(CMP, RESULTS), "");
    paintCompare(b, compareRows(CMP, RESULTS), "");
    await Promise.resolve();
    mo.disconnect();
    expect(records).toHaveLength(0);
    expect(b.querySelectorAll(".coto-unit-cmp")).toHaveLength(1);
    expect(b.querySelectorAll(".coto-unit-cmp-row")).toHaveLength(3);
    b.remove();
  });
});
