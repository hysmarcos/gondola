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

describe("paintCompare: logos de los súper en el detalle", () => {
  const logo = (id) => (id === "mas" ? null : `chrome-extension://x/assets/stores/${id}.png`);
  function paint(opts) {
    document.body.innerHTML = `<div id="box"></div>`;
    const box = document.getElementById("box");
    const results = { carrefour: offer(1840, { url: "https://www.carrefour.com.ar/leche/p" }), dia: offer(2100), mas: "missing" };
    paintCompare(box, compareRows(cmp, results), "icon", opts);
    return [...box.querySelectorAll(".coto-unit-cmp-pop .coto-unit-cmp-name")];
  }

  it("cada fila lleva su logo delante del nombre; el link sigue siendo el nombre", () => {
    const names = paint({ logo });
    expect(names.map((n) => n.textContent)).toEqual(["Coto", "Carrefour", "Día", "Más"]);
    const src = names.map((n) => n.querySelector("img.coto-unit-cmp-logo")?.getAttribute("src") ?? null);
    expect(src).toEqual([
      "chrome-extension://x/assets/stores/coto.png",
      "chrome-extension://x/assets/stores/carrefour.png",
      "chrome-extension://x/assets/stores/dia.png",
      null,
    ]);
    // Decorativo: el nombre está escrito al lado.
    expect(names[1].firstChild.getAttribute("alt")).toBe("");
    expect(names[1].tagName).toBe("A");
  });

  it("sin logos, las filas quedan solo con el nombre", () => {
    expect(paint().some((n) => n.querySelector("img"))).toBe(false);
  });
});
