// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { compareRows, compareStatus, paintCompare } from "../src/compare-ui.js";

const cmp = { unit: 2000, qty: 1 };
const offer = (unit, extra = {}) => ({ unit, qty: 1, promo: null, url: null, ...extra });

describe("compareStatus", () => {
  it("peor si algún súper es más barato; mejor si todos son más caros", () => {
    expect(compareStatus(compareRows(cmp, { carrefour: offer(1800), dia: offer(2100), mas: "missing" }))).toBe("worse");
    expect(compareStatus(compareRows(cmp, { carrefour: offer(2200), dia: offer(2005), mas: "missing" }))).toBe("better");
    expect(compareStatus(compareRows(cmp, { carrefour: offer(2005), dia: "missing", mas: "error" }))).toBe("equal");
    expect(compareStatus(compareRows(cmp, { carrefour: "missing", dia: "missing", mas: "error" }))).toBe("none");
    expect(compareStatus(compareRows(cmp, undefined))).toBe("pending");
  });
});

describe("compareRows: links y diferencia", () => {
  it("solo links del mismo súper y por https; diferencia en %", () => {
    const rows = compareRows(cmp, {
      carrefour: offer(1840, { url: "https://www.carrefour.com.ar/leche/p" }),
      dia: offer(2100, { url: "https://otro-sitio.com/leche" }),
      mas: offer(2000, { url: "javascript:alert(1)" }),
    });
    expect(rows.map((r) => r.url)).toEqual(["https://www.carrefour.com.ar/leche/p", null, null]);
    expect(rows.map((r) => r.delta)).toEqual([-8, 5, 0]);
  });
});

describe("pastilla: palabra corta por estado", () => {
  const text = (results) => {
    document.body.innerHTML = `<div id="b"></div>`;
    const box = document.getElementById("b");
    paintCompare(box, compareRows(cmp, results), "icon");
    return box.querySelector(".coto-unit-cmp-text").textContent;
  };
  it("mejor, igual, sin comparar y comparando", () => {
    expect(text({ carrefour: offer(2200), dia: "missing", mas: "missing" })).toBe("Mejor precio");
    expect(text({ carrefour: offer(2005), dia: "missing", mas: "missing" })).toBe("Igual");
    expect(text({ carrefour: "missing", dia: "missing", mas: "error" })).toBe("Sin comparar");
    expect(text(undefined)).toBe("Comparando…");
  });
  it("con varios más baratos, nombra el más barato de todos", () => {
    expect(text({ carrefour: offer(1900), dia: offer(1700), mas: offer(1800) })).toBe("Más barato en Día");
  });
});

describe("paintCompare: ícono con detalle al pasar el mouse", () => {
  function paint(results) {
    document.body.innerHTML = `<div id="box"></div>`;
    const box = document.getElementById("box");
    paintCompare(box, compareRows(cmp, results), "icon");
    return box;
  }

  it("un solo botón con el estado; el detalle tiene a Coto y cada súper", () => {
    const box = paint({ carrefour: offer(1840, { url: "https://www.carrefour.com.ar/leche/p" }), dia: offer(2100, { qty: 2 }), mas: "missing" });
    const block = box.querySelector(".coto-unit-cmp");
    expect(block.dataset.state).toBe("worse");
    const btn = block.querySelector("button.coto-unit-cmp-btn");
    expect(btn.getAttribute("aria-label")).toBe("Más barato en Carrefour. Ver comparación");
    expect(btn.querySelector(".coto-unit-cmp-text").textContent).toBe("Más barato en Carrefour");
    expect(btn.getAttribute("aria-expanded")).toBe("false");
    expect(btn.querySelector("svg")).not.toBeNull();
    const pop = block.querySelector(".coto-unit-cmp-pop");
    const rows = [...pop.querySelectorAll(".coto-unit-cmp-row")];
    expect(rows.map((r) => r.querySelector(".coto-unit-cmp-name").textContent)).toEqual(["Coto", "Carrefour", "Día", "Más"]);
    const link = rows[1].querySelector("a");
    expect(link.getAttribute("href")).toBe("https://www.carrefour.com.ar/leche/p");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
    expect(rows[1].querySelector(".coto-unit-cmp-delta").textContent).toBe("−8%");
    expect(rows[2].querySelector(".coto-unit-cmp-qty").textContent).toBe("x2");
    expect(rows[3].querySelector("a")).toBeNull();
    expect(rows[3].querySelector(".coto-unit-cmp-price").textContent).toBe("No está");
  });

  it("al tocar el botón se abre y se cierra (celulares)", () => {
    const box = paint({ carrefour: offer(2200), dia: "missing", mas: "missing" });
    const btn = box.querySelector("button.coto-unit-cmp-btn");
    btn.click();
    expect(box.querySelector(".coto-unit-cmp").hasAttribute("data-open")).toBe(true);
    expect(btn.getAttribute("aria-expanded")).toBe("true");
    btn.click();
    expect(box.querySelector(".coto-unit-cmp").hasAttribute("data-open")).toBe(false);
  });

  it("repintar con lo mismo no toca el DOM", () => {
    const results = { carrefour: offer(2200), dia: "missing", mas: "missing" };
    const box = paint(results);
    const before = box.querySelector(".coto-unit-cmp-btn");
    paintCompare(box, compareRows(cmp, results), "icon");
    expect(box.querySelector(".coto-unit-cmp-btn")).toBe(before);
  });
});

describe("paintCompare: el logo del súper reemplaza al nombre", () => {
  const logo = (id) => (id === "mas" ? null : `chrome-extension://x/assets/stores/${id}.png`);
  const results = { carrefour: offer(1840, { url: "https://www.carrefour.com.ar/leche/p" }), dia: offer(2100), mas: "missing" };
  function paint(variant, opts, res = results) {
    document.body.innerHTML = `<div id="box"></div>`;
    const box = document.getElementById("box");
    paintCompare(box, compareRows(cmp, res), variant, opts);
    return box;
  }
  const names = (box) => [...box.querySelectorAll(".coto-unit-cmp-name")];

  it("detalle de la pastilla: logo con el nombre como texto alternativo; sin logo, el nombre", () => {
    const list = names(paint("icon", { logo }));
    expect(list.map((n) => n.querySelector("img.coto-unit-cmp-logo")?.getAttribute("alt") ?? n.textContent)).toEqual(["Coto", "Carrefour", "Día", "Más"]);
    expect(list.map((n) => n.querySelector("img")?.getAttribute("src") ?? null)).toEqual([
      "chrome-extension://x/assets/stores/coto.png",
      "chrome-extension://x/assets/stores/carrefour.png",
      "chrome-extension://x/assets/stores/dia.png",
      null,
    ]);
    // Con logo no se repite el nombre escrito; el link sigue abriendo el súper.
    expect(list[1].textContent).toBe("");
    expect(list[1].tagName).toBe("A");
    expect(list[1].getAttribute("href")).toBe("https://www.carrefour.com.ar/leche/p");
    expect(list[1].classList.contains("coto-unit-cmp-name--logo")).toBe(true);
    expect(list[3].classList.contains("coto-unit-cmp-name--logo")).toBe(false);
  });

  it("filas (página de producto): logo en lugar del nombre", () => {
    const list = names(paint("", { logo }));
    expect(list.map((n) => n.querySelector("img")?.getAttribute("alt") ?? n.textContent)).toEqual(["Carrefour", "Día", "Más"]);
    expect(list[0].tagName).toBe("A");
  });

  it("línea corta (carruseles y carrito): logo + precio; la etiqueta para lectores sigue con el nombre", () => {
    const best = paint("mini", { logo }).querySelector(".coto-unit-cmp-best");
    expect(best.querySelector("img.coto-unit-cmp-logo").getAttribute("alt")).toBe("Carrefour");
    expect(best.textContent).toBe("$1.840 ▼");
    expect(best.getAttribute("aria-label")).toMatch(/^Carrefour: /);
  });

  it("línea corta cuando Coto gana: logo de Coto + \"el más barato\"", () => {
    const best = paint("mini", { logo }, { carrefour: offer(2200), dia: "missing", mas: "missing" }).querySelector(".coto-unit-cmp-best");
    expect(best.querySelector("img").getAttribute("alt")).toBe("Coto");
    expect(best.textContent).toBe("el más barato");
    expect(best.getAttribute("aria-label")).toBe("Coto el más barato");
  });

  it("sin logos, todo queda con el nombre escrito", () => {
    expect(paint("icon").querySelector("img")).toBe(null);
    expect(paint("mini").querySelector(".coto-unit-cmp-best").textContent).toBe("Carrefour $1.840 ▼");
  });
});
