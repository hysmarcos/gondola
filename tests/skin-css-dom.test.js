// Cada selector de los CSS de la piel encuentra algo en el HTML real de Coto
// (tests/fixtures/dom/): un selector que ya no encuentra nada es una regla muerta, o Coto
// cambió su HTML. skin-list.css se prueba contra la lista, skin-pdp.css contra la PDP y
// skin.css contra cualquiera de las dos.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import { selectors, bare } from "./helpers/css.js";

const load = (f) => new JSDOM(readFileSync(`tests/fixtures/dom/${f}.html`, "utf8")).window.document;
const LISTA = load("lista");
const PDP = load("pdp");
const FILES = [
  ["src/skin.css", [LISTA, PDP]],
  ["src/skin-list.css", [LISTA]],
  ["src/skin-pdp.css", [PDP]],
];

// Nodos propios de Góndola (no están en el HTML de Coto) y el selector de cantidad, que solo
// existe con sesión iniciada (sin captura).
const SKIP = /coto-unit|data-coto|data-basis|data-skin|input-prod/;

// No hace falta una lista de excepciones: la captura de la lista tiene un filtro puesto, así
// que también están los chips de "Su selección" y el filtro activo.

describe("bare", () => {
  it("saca el prefijo, los pseudo-elementos y los estados", () => {
    expect(bare('[data-gondola-skin="list"] .a > b:hover::before')).toBe(".a > b");
    expect(bare("[data-gondola-skin] .btn:not(:disabled):hover")).toBe(".btn");
    expect(bare('[data-gondola-skin="pdp"] .x:focus:not(:focus-visible)')).toBe(".x");
    expect(bare("[data-gondola-skin]")).toBe("");
    expect(bare('[data-gondola-skin="list"] .a:has(> .b)')).toBe(".a:has(> .b)");
    expect(bare('[data-gondola-skin="list"][data-gondola-theme="dark"] #f > a::before')).toBe("#f > a");
    expect(bare('[data-gondola-theme="dark"]:not([data-gondola-skin]) .card a')).toBe(".card a");
  });
});

describe.each(FILES)("%s", (file, docs) => {
  const list = [...new Set(selectors(readFileSync(file, "utf8")).map(bare))].filter((s) => s && !SKIP.test(s));
  it("tiene selectores para probar", () => {
    expect(list.length).toBeGreaterThan(0);
  });
  it("cada selector encuentra al menos un nodo en el HTML de Coto", () => {
    const dead = list.filter((s) => !docs.some((d) => d.querySelector(s)));
    expect(dead).toEqual([]);
  });
});
