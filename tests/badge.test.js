// @vitest-environment jsdom
import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { installBadges, formatBadge, groupMark } from "../src/badge.js";

const KEY = "_/R-00286626-00286626-200";
const KEY2 = "_/R-00012849-00012849-200";

const card = (key) => `
  <div class="producto-card"><constructor-result-item><div class="card-container">
    <a href="/productos/ravioles/${key}"><h3>Ravioles</h3></a>
    <div class="centro-precios"><h4>$3.459</h4><button>Agregar</button></div>
  </div></constructor-result-item></div>`;

const send = (data) => window.dispatchEvent(new MessageEvent("message", { data }));
const tick = () => new Promise((r) => setTimeout(r, 0));
const labels = {
  [KEY]: { group: "kg", value: 5177.44, drained: false, groupStart: true },
  [KEY2]: { group: "kg", value: 9597.08, drained: false, groupStart: false },
};

describe("textos", () => {
  it("formatea las etiquetas", () => {
    expect(formatBadge({ group: "kg", value: 5177.4, drained: false })).toBe("$5.177/kg final");
    expect(formatBadge({ group: "L", value: 3000, drained: true })).toBe("$3.000/L escurrido");
    expect(formatBadge({ group: "unidad", value: 950, drained: false })).toBe("$950/unidad final");
    expect(formatBadge({ group: "sin_dato", value: null, drained: false })).toBeNull();
    expect(groupMark("kg")).toBe("▸ Por kilo");
    expect(groupMark("L")).toBe("▸ Por litro");
    expect(groupMark("unidad")).toBe("▸ Por unidad");
  });
});

describe("installBadges", () => {
  beforeAll(() => installBadges(window, document));
  beforeEach(async () => {
    send({ source: "coto-unit", type: "labels", active: false });
    document.body.innerHTML = `<div class="plp-header__sort"><select id="plpSort"></select></div><div id="grid">${card(KEY)}</div>`;
    await tick();
  });

  it("agrega etiqueta y marca de grupo sin mover nada de Coto", async () => {
    send({ source: "coto-unit", type: "labels", active: true, labels });
    await tick();
    const c = document.querySelector(".card-container");
    expect(c.querySelector(".coto-unit-badge").textContent).toBe("$5.177/kg final");
    expect(c.querySelector(".coto-unit-mark").textContent).toBe("▸ Por kilo");
    expect(c.firstElementChild.tagName).toBe("A");
    expect(c.querySelector("button").textContent).toBe("Agregar");
  });

  it("etiqueta tarjetas que Angular agrega después, sin duplicar", async () => {
    send({ source: "coto-unit", type: "labels", active: true, labels });
    await tick();
    document.getElementById("grid").insertAdjacentHTML("beforeend", card(KEY2));
    await tick();
    send({ source: "coto-unit", type: "labels", active: true, labels });
    await tick();
    expect(document.querySelectorAll(".coto-unit-badge")).toHaveLength(2);
    expect(document.querySelectorAll(".coto-unit-mark")).toHaveLength(1);
  });

  it("si Angular reutiliza la tarjeta para otro producto, actualiza el texto", async () => {
    send({ source: "coto-unit", type: "labels", active: true, labels });
    await tick();
    document.querySelector(".card-container a").setAttribute("href", "/productos/x/" + KEY2);
    await tick();
    expect(document.querySelector(".coto-unit-badge").textContent).toBe("$9.597/kg final");
    expect(document.querySelector(".coto-unit-mark")).toBeNull();
  });

  it("con otro orden, saca todo lo que agregó", async () => {
    send({ source: "coto-unit", type: "labels", active: true, labels });
    await tick();
    send({ source: "coto-unit", type: "notice", text: "No se pudo ordenar por precio por kg" });
    send({ source: "coto-unit", type: "labels", active: false });
    await tick();
    expect(document.querySelectorAll(".coto-unit-badge, .coto-unit-mark, .coto-unit-notice")).toHaveLength(0);
  });

  it("muestra un aviso debajo del menú, una sola vez", async () => {
    send({ source: "coto-unit", type: "notice", text: "Se ordenaron los primeros 1.000 productos" });
    send({ source: "coto-unit", type: "notice", text: "Se ordenaron los primeros 1.000 productos" });
    await tick();
    const n = document.querySelectorAll(".coto-unit-notice");
    expect(n).toHaveLength(1);
    expect(n[0].previousElementSibling.className).toBe("plp-header__sort");
  });

  it("ignora mensajes de otros", async () => {
    send({ source: "otro", type: "labels", active: true, labels });
    await tick();
    expect(document.querySelectorAll(".coto-unit-badge")).toHaveLength(0);
  });
});
