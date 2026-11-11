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

describe("createNutritionUi con request que falla", () => {
  it("si request rechaza o tira, no rompe y no dibuja", async () => {
    document.body.innerHTML = `<div id="c"></div>`;
    const c = document.getElementById("c");
    let updates = 0;
    const rejecting = createNutritionUi(document, { request: () => Promise.reject(new Error("Extension context invalidated")), onUpdate: () => updates++ });
    const throwing = createNutritionUi(document, { request: () => { throw new Error("x"); }, onUpdate: () => updates++ });
    const label = { ean: "1", nutri: true, group: "kg" };
    expect(() => rejecting.paint(c, null, label, true)).not.toThrow();
    expect(() => throwing.paint(c, null, label, true)).not.toThrow();
    await new Promise((r) => setTimeout(r, 0));
    rejecting.paint(c, null, label, true);
    throwing.paint(c, null, label, true);
    expect(updates).toBe(2);
    expect(c.querySelector(".coto-unit-nutri")).toBeNull();
  });
});

describe("bebidas vendidas por unidad", () => {
  it("drink por unidad dice cada 100 ml; drink en polvo (kg) dice cada 100 g", async () => {
    document.body.innerHTML = `<div id="c"></div>`;
    const c = document.getElementById("c");
    const N2 = { per100: { kcal: 42, carbs: 10, sugars: 10 }, perServing: null, servingSize: null, url: "u" };
    const ui = createNutritionUi(document, { request: async () => N2, onUpdate: () => {} });
    ui.paint(c, null, { ean: "1", nutri: true, drink: true, group: "unidad" }, true);
    await new Promise((r) => setTimeout(r, 0));
    ui.paint(c, null, { ean: "1", nutri: true, drink: true, group: "unidad" }, true);
    expect(c.querySelector("summary").textContent).toContain("cada 100 ml");
    c.innerHTML = "";
    ui.paint(c, null, { ean: "1", nutri: true, drink: true, group: "kg" }, true);
    expect(c.querySelector("summary").textContent).toContain("cada 100 g");
  });
});

describe("diseño A: resumen en la columna y sección junto a la descripción", () => {
  let container, anchor, host, desc, ui;
  const ICON = "chrome-extension://x/assets/off/off-logo-icon-light.svg";
  const N3 = { per100: { kcal: 42, carbs: 11, sugars: 11, sodiumMg: 6 }, perServing: { kcal: 149 }, servingSize: "354 ml", url: "https://world.openfoodfacts.org/product/7790895000232" };
  const label = (ean = "7790895000232", extra = {}) => ({ ean, nutri: true, drink: true, group: "L", ...extra });
  const settle = () => new Promise((r) => setTimeout(r, 0));

  beforeEach(() => {
    document.body.innerHTML = `<div class="mt-4"><div id="a"></div><div id="cuotas"></div></div>
      <div class="col-12 mt-3 mb-5"><div class="mb-3 pdp-description"><h4>Descripción del producto</h4></div><div class="pdp-characteristics"></div></div>`;
    container = document.querySelector(".mt-4");
    anchor = document.getElementById("a");
    desc = document.querySelector(".pdp-description");
    host = desc.parentElement;
  });

  async function draw(result, lab = label()) {
    ui = createNutritionUi(document, { request: async () => result, onUpdate: () => {}, iconUrl: ICON });
    const section = { host, after: desc };
    ui.paint(container, anchor, lab, true, section);
    await settle();
    ui.paint(container, anchor, lab, true, section);
    return section;
  }

  it("con tabla: una línea de resumen en la columna y la tabla en la sección", async () => {
    await draw(N3);
    const sum = container.querySelector(".coto-unit-nutri-sum");
    expect(anchor.nextElementSibling).toBe(sum);
    expect(sum.querySelector(".coto-unit-nutri-text").textContent).toBe("42 kcal · 11 g azúcares · 6 mg sodio · cada 100 ml");
    expect(sum.querySelector("img").getAttribute("src")).toBe(ICON);
    expect(sum.querySelector("button").textContent).toBe("Ver tabla");
    const sec = host.querySelector(".coto-unit-nutri-section");
    expect(desc.nextElementSibling).toBe(sec);
    expect(sec.querySelector("h4").textContent).toBe("Información nutricional");
    expect(sec.querySelector("h4 img").getAttribute("src")).toBe(ICON);
    expect(sec.querySelector("h4 img").alt).toBe("Open Food Facts");
    expect(sec.querySelector("table")).not.toBeNull();
    expect(sec.querySelector("details")).toBeNull();
    expect(sec.textContent).toContain("Fuente: Open Food Facts, datos cargados por la comunidad.");
    expect(host.hasAttribute("data-coto-unit-nutri-host")).toBe(true);
  });

  it("Ver tabla lleva a la sección sin cambiar la URL", async () => {
    await draw(N3);
    const sec = host.querySelector(".coto-unit-nutri-section");
    let scrolled = false;
    sec.scrollIntoView = () => (scrolled = true);
    container.querySelector(".coto-unit-nutri-sum button").click();
    expect(scrolled).toBe(true);
  });

  it("missing: sin resumen; la sección dice cómo cargarla", async () => {
    await draw("missing");
    expect(container.querySelector(".coto-unit-nutri-sum")).toBeNull();
    const sec = host.querySelector(".coto-unit-nutri-section");
    expect(sec.querySelector("h4").textContent).toBe("Información nutricional");
    expect(sec.textContent).toContain("Sin información nutricional. Podés cargarla en Open Food Facts");
  });

  it("resumen solo con los datos que hay; sin kcal, azúcares ni sodio no hay resumen", async () => {
    await draw({ ...N3, per100: { kcal: 42, fat: 0, carbs: 11 } }, label("1", { drink: false, group: "kg" }));
    expect(container.querySelector(".coto-unit-nutri-text").textContent).toBe("42 kcal · cada 100 g");
    document.body.innerHTML = `<div class="mt-4"><div id="a"></div></div><div><div class="pdp-description"></div></div>`;
    container = document.querySelector(".mt-4"); anchor = document.getElementById("a"); desc = document.querySelector(".pdp-description"); host = desc.parentElement;
    await draw({ ...N3, per100: { fat: 0, carbs: 11, proteins: 1 } });
    expect(container.querySelector(".coto-unit-nutri-sum")).toBeNull();
    expect(host.querySelector(".coto-unit-nutri-section table")).not.toBeNull();
  });

  it("apagar el ajuste o pasar a otro producto borra resumen, sección y marca del contenedor", async () => {
    const section = await draw(N3);
    ui.paint(container, anchor, label(), false, section);
    expect(container.querySelector(".coto-unit-nutri-sum")).toBeNull();
    expect(host.querySelector(".coto-unit-nutri-section")).toBeNull();
    expect(host.hasAttribute("data-coto-unit-nutri-host")).toBe(false);
    ui.paint(container, anchor, label(), true, section);
    expect(host.querySelector(".coto-unit-nutri-section")).not.toBeNull();
    ui.paint(container, anchor, label("999"), true, section);
    expect(host.querySelector(".coto-unit-nutri-section")).toBeNull();
    expect(container.querySelector(".coto-unit-nutri-sum")).toBeNull();
  });

  it("repintar el mismo producto no duplica ni reemplaza los nodos", async () => {
    const section = await draw(N3);
    const sum = container.querySelector(".coto-unit-nutri-sum");
    const sec = host.querySelector(".coto-unit-nutri-section");
    ui.paint(container, anchor, label(), true, section);
    expect(container.querySelectorAll(".coto-unit-nutri-sum")).toHaveLength(1);
    expect(container.querySelector(".coto-unit-nutri-sum")).toBe(sum);
    expect(host.querySelector(".coto-unit-nutri-section")).toBe(sec);
  });

  it("sin sección (página sin descripción) usa el desplegable en la columna", async () => {
    ui = createNutritionUi(document, { request: async () => N3, onUpdate: () => {}, iconUrl: ICON });
    ui.paint(container, anchor, label(), true, null);
    await settle();
    ui.paint(container, anchor, label(), true, null);
    expect(container.querySelector("details.coto-unit-nutri")).not.toBeNull();
    expect(container.querySelector(".coto-unit-nutri-sum")).toBeNull();
  });
});
