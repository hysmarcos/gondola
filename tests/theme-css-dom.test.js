// src/theme-coto.css pinta de oscuro las páginas de Coto. Cada regla cuelga de
// [data-gondola-theme="dark"] (en claro no toca nada) y cada selector encuentra algo en el
// HTML real de Coto (tests/fixtures/dom/): uno que no encuentra nada es una regla muerta, o
// Coto cambió su HTML. Lo que solo existe con sesión o al abrirse (mini carrito, ventanas)
// no está en las capturas: esa regla lleva encima /* sin captura: <motivo> */.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import { rules, bare } from "./helpers/css.js";

const FILE = "src/theme-coto.css";
const PREFIX = '[data-gondola-theme="dark"]';
const CAPTURAS = ["lista", "pdp", "header", "footer", "home", "ingresar"];
// Tope de reglas sin captura. Eran 15; sube por dos grupos que no se pueden capturar sin sesión
// ni sin abrirlos: el carrito y el mini carrito (sin sesión /carrito lleva al ingreso) y las
// ventanas, globos y avisos (solo existen abiertos).
const MAX_SIN_CAPTURA = 32;
const SIN_CAPTURA = /^\/\*\s*sin captura:\s*\S/;

const docs = CAPTURAS.map((f) => new JSDOM(readFileSync(`tests/fixtures/dom/${f}.html`, "utf8")).window.document);
const encuentra = (sel) => docs.some((d) => d.querySelector(sel));

const todas = rules(readFileSync(FILE, "utf8"));
const conMarca = todas.filter((r) => r.comments.some((c) => SIN_CAPTURA.test(c)));
const sinMarca = todas.filter((r) => !conMarca.includes(r));
const pelados = (lista) => [...new Set(lista.flatMap((r) => r.selectors).map(bare))].filter(Boolean);

describe("rules", () => {
  it("devuelve los selectores de cada regla con los comentarios de encima", () => {
    const css = "/* a */ .x, .y { color: red; }\n/* sin captura: b */\n.z:hover { color: blue; }\n@media print { .w { color: red; } }";
    expect(rules(css)).toEqual([
      { selectors: [".x", ".y"], comments: ["/* a */"] },
      { selectors: [".z:hover"], comments: ["/* sin captura: b */"] },
      { selectors: [".w"], comments: [] },
    ]);
  });
});

describe(FILE, () => {
  it("tiene reglas para probar", () => {
    expect(sinMarca.length).toBeGreaterThan(0);
  });

  it(`toda regla empieza con ${PREFIX}`, () => {
    const sueltas = todas.flatMap((r) => r.selectors).filter((s) => !s.startsWith(PREFIX));
    expect(sueltas).toEqual([]);
  });

  it("cada selector encuentra al menos un nodo en alguna captura de Coto", () => {
    expect(pelados(sinMarca).filter((s) => !encuentra(s))).toEqual([]);
  });

  it(`no más de ${MAX_SIN_CAPTURA} reglas sin captura, y ninguna marcada de más`, () => {
    expect(conMarca.length).toBeLessThanOrEqual(MAX_SIN_CAPTURA);
    // Si todos sus selectores ya están en las capturas, la marca sobra.
    const deMas = conMarca.filter((r) => r.selectors.map(bare).filter(Boolean).every(encuentra));
    expect(deMas.map((r) => r.selectors.join(", "))).toEqual([]);
  });
});
