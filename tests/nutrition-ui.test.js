// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { renderNutrition, createNutritionUi } from "../src/nutrition-ui.js";

const N = {
  per100: { kcal: 480, carbs: 70.25, sugars: 30, fat: 20, sodiumMg: 250 },
  perServing: { kcal: 144 },
  servingSize: "30 g",
  url: "https://world.openfoodfacts.org/product/1",
};

describe("renderNutrition", () => {
  it("resumen con kcal y tabla con columna por porción", () => {
    const el = renderNutrition(document, N, { ean: "1", liquid: false });
    expect(el.classList.contains("coto-unit-nutri")).toBe(true);
    expect(el.dataset.ean).toBe("1");
    expect(el.querySelector("summary").textContent).toBe("Información nutricional · 480 kcal cada 100 g");
    const ths = [...el.querySelectorAll("th")].map((t) => t.textContent);
    expect(ths).toContain("cada 100 g");
    expect(ths).toContain("Por porción (30 g)");
    expect(el.textContent).toContain("70,3 g");
    expect(el.textContent).toContain("250 mg");
    expect(el.textContent).toContain("144 kcal");
    expect(el.textContent).toContain("Fuente: Open Food Facts, datos cargados por la comunidad.");
    const a = el.querySelector("a");
    expect(a.href).toBe("https://world.openfoodfacts.org/product/1");
    expect(a.textContent).toBe("Ver ficha");
    expect(a.target).toBe("_blank");
    expect(a.rel).toBe("noopener noreferrer");
  });

  it("filas en el orden de la tabla y solo los nutrientes presentes", () => {
    const el = renderNutrition(document, N, { ean: "1", liquid: false });
    const names = [...el.querySelectorAll("tbody tr")].map((tr) => tr.firstChild.textContent);
    expect(names).toEqual(["Valor energético", "Carbohidratos", "Azúcares", "Grasas totales", "Sodio"]);
  });

  it("bebida dice cada 100 ml", () => {
    const el = renderNutrition(document, N, { ean: "1", liquid: true });
    expect(el.querySelector("summary").textContent).toBe("Información nutricional · 480 kcal cada 100 ml");
  });

  it("porción sin serving_size dice Por porción; sin porción no hay columna", () => {
    const sin = renderNutrition(document, { ...N, servingSize: null }, { ean: "1", liquid: false });
    expect([...sin.querySelectorAll("th")].map((t) => t.textContent)).toContain("Por porción");
    const sinCol = renderNutrition(document, { ...N, perServing: null }, { ean: "1", liquid: false });
    expect(sinCol.querySelectorAll("thead th")).toHaveLength(2);
  });

  it("sin kcal el resumen es solo el título", () => {
    const el = renderNutrition(document, { ...N, per100: { carbs: 1, fat: 2, sugars: 3 } }, { ean: "1", liquid: false });
    expect(el.querySelector("summary").textContent).toBe("Información nutricional");
  });

  it("missing: una línea con link para cargarla", () => {
    const el = renderNutrition(document, "missing", { ean: "779", liquid: false });
    expect(el.textContent).toBe("Sin información nutricional. Podés cargarla en Open Food Facts");
    const a = el.querySelector("a");
    expect(a.href).toBe("https://world.openfoodfacts.org/product/779");
    expect(a.textContent).toBe("Podés cargarla en Open Food Facts");
    expect(a.rel).toBe("noopener noreferrer");
  });
});

describe("createNutritionUi", () => {
  let container, anchor, pending, calls, updates, ui;

  // request falso: cada EAN queda pendiente hasta que el test lo resuelve.
  beforeEach(() => {
    document.body.innerHTML = `<div id="c"><div id="a"></div><div id="z"></div></div>`;
    container = document.getElementById("c");
    anchor = document.getElementById("a");
    pending = {};
    calls = [];
    updates = 0;
    ui = createNutritionUi(document, {
      request: (ean) => {
        calls.push(ean);
        return new Promise((resolve) => (pending[ean] = resolve));
      },
      onUpdate: () => updates++,
    });
  });

  const label = (ean, extra = {}) => ({ ean, nutri: true, group: "kg", ...extra });
  const block = () => container.querySelector(".coto-unit-nutri");
  const settle = async (ean, value) => {
    pending[ean](value);
    await new Promise((r) => setTimeout(r, 0));
  };

  it("pide una vez por EAN y dibuja después de onUpdate", async () => {
    ui.paint(container, anchor, label("1"), true);
    ui.paint(container, anchor, label("1"), true);
    expect(calls).toEqual(["1"]);
    expect(block()).toBeNull();
    await settle("1", N);
    expect(updates).toBe(1);
    ui.paint(container, anchor, label("1"), true);
    expect(block().dataset.ean).toBe("1");
    expect(anchor.nextElementSibling).toBe(block());
  });

  it("no pide si no es comida, sin EAN o con el ajuste apagado", () => {
    ui.paint(container, anchor, label("1", { nutri: false }), true);
    ui.paint(container, anchor, label(null), true);
    ui.paint(container, anchor, label("1"), false);
    ui.paint(container, anchor, undefined, true);
    expect(calls).toEqual([]);
    expect(block()).toBeNull();
  });

  it("apagar el ajuste borra el bloque", async () => {
    ui.paint(container, anchor, label("1"), true);
    await settle("1", N);
    ui.paint(container, anchor, label("1"), true);
    ui.paint(container, anchor, label("1"), false);
    expect(block()).toBeNull();
  });

  it("error: no dibuja nada", async () => {
    ui.paint(container, anchor, label("1"), true);
    await settle("1", "error");
    ui.paint(container, anchor, label("1"), true);
    expect(block()).toBeNull();
  });

  it("missing: dibuja la línea para cargarla", async () => {
    ui.paint(container, anchor, label("1"), true);
    await settle("1", "missing");
    ui.paint(container, anchor, label("1"), true);
    expect(block().textContent).toContain("Sin información nutricional");
  });

  it("bebida en litros: cada 100 ml", async () => {
    ui.paint(container, anchor, label("1", { group: "L" }), true);
    await settle("1", N);
    ui.paint(container, anchor, label("1", { group: "L" }), true);
    expect(block().querySelector("summary").textContent).toContain("cada 100 ml");
  });

  it("SPA: al pasar de A a B no queda la tabla de A", async () => {
    ui.paint(container, anchor, label("A"), true);
    await settle("A", N);
    ui.paint(container, anchor, label("A"), true);
    ui.paint(container, anchor, label("B"), true);
    expect(block()).toBeNull();
    await settle("B", N);
    ui.paint(container, anchor, label("B"), true);
    expect(block().dataset.ean).toBe("B");
  });

  it("respuesta tardía de A con B en pantalla no dibuja A", async () => {
    ui.paint(container, anchor, label("A"), true);
    ui.paint(container, anchor, label("B"), true);
    await settle("A", N);
    ui.paint(container, anchor, label("B"), true);
    expect(container.querySelector('[data-ean="A"]')).toBeNull();
  });

  it("mismo EAN no reemplaza el bloque (details abierto sigue abierto)", async () => {
    ui.paint(container, anchor, label("1"), true);
    await settle("1", N);
    ui.paint(container, anchor, label("1"), true);
    const first = block();
    first.open = true;
    ui.paint(container, anchor, label("1"), true);
    expect(block()).toBe(first);
    expect(block().open).toBe(true);
  });

  it("sin anchor va al final del contenedor", async () => {
    ui.paint(container, null, label("1"), true);
    await settle("1", N);
    ui.paint(container, null, label("1"), true);
    expect(container.lastElementChild).toBe(block());
  });
});
