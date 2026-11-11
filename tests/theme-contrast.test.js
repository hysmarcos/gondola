import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

// Lee los tokens --g-* de src/theme.css (bloque :root, bloque oscuro y bloque de impresión)
// y verifica el contraste WCAG de cada par texto/fondo, en claro y en oscuro.

const css = readFileSync("src/theme.css", "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

// Cuerpo del primer bloque `selector { … }` (con llaves anidadas balanceadas) a partir de `desde`.
function bloque(selector, desde = css) {
  const i = desde.indexOf(selector);
  if (i < 0) return null;
  const ini = desde.indexOf("{", i);
  let nivel = 0;
  for (let j = ini; j < desde.length; j++) {
    if (desde[j] === "{") nivel++;
    else if (desde[j] === "}" && --nivel === 0) return desde.slice(ini + 1, j);
  }
  return null;
}

// Cualquier valor (no solo hex): --g-plate es `transparent` en claro y --g-out una curva.
function tokens(cuerpo) {
  const out = {};
  if (!cuerpo) return out;
  for (const m of cuerpo.matchAll(/--g-([\w-]+)\s*:\s*([^;]+);/g)) out[m[1]] = m[2].trim();
  return out;
}

const claro = tokens(bloque(":root"));
const oscuro = tokens(bloque('[data-gondola-theme="dark"]'));
const impresion = tokens(bloque('[data-gondola-theme="dark"]', bloque("@media print")));

const HEX = /^#[0-9a-f]{6}$/i;
function luminancia(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contraste(a, b) {
  const [x, y] = [luminancia(a), luminancia(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

const PARES = [ // [texto, fondo, mínimo]
  ["ink", "bg", 4.5], ["ink", "surface", 4.5], ["ink", "surface-2", 4.5], ["ink", "soft", 4.5],
  ["ink2", "bg", 4.5], ["ink2", "surface", 4.5], ["ink2", "soft", 4.5],
  ["red-text", "bg", 4.5], ["red-text", "surface", 4.5],
  ["#ffffff", "red", 4.5], ["#ffffff", "red-d", 4.5], ["#ffffff", "navy-fill", 4.5],
  ["navy", "navy-soft", 4.5], ["navy", "surface", 4.5],
  ["amber-ink", "amber-soft", 4.5], ["green", "green-soft", 4.5], ["green", "surface", 4.5],
  ["line", "bg", 1.2], // el borde se distingue del fondo
  ["blue", "blue-soft", 4.5], ["blue", "surface", 4.5],
  ["danger", "danger-soft", 4.5], ["danger", "surface", 4.5],
  ["ink3", "surface", 3], // adorno o texto grande
  ["line-2", "surface", 1.5], ["blue-line", "surface", 1.2],
  ["#ffffff", "danger-fill", 4.5], ["#ffffff", "green-fill", 4.5],
  ["on-amber", "amber", 4.5], ["navy", "navy-hover", 4.5],
  ["orange", "surface", 4.5], ["rust", "surface", 4.5],
];

describe("tokens de src/theme.css", () => {
  it("hay bloque claro, oscuro y de impresión", () => {
    expect(Object.keys(claro).length).toBeGreaterThan(15);
    expect(Object.keys(oscuro).length).toBeGreaterThan(15);
    expect(Object.keys(impresion).length).toBeGreaterThan(15);
  });

  it("los dos bloques definen los mismos nombres (--g-out solo en :root)", () => {
    expect(Object.keys(oscuro).sort()).toEqual(Object.keys(claro).filter((n) => n !== "out").sort());
  });

  it("ningún token oscuro vale negro puro ni blanco puro", () => {
    for (const [n, v] of Object.entries(oscuro)) {
      expect(["#000000", "#000", "#ffffff", "#fff"], `--g-${n}`).not.toContain(v.toLowerCase());
    }
  });

  it("al imprimir, cada token del bloque oscuro vuelve a su valor claro", () => {
    for (const n of Object.keys(oscuro)) {
      expect(impresion[n], `--g-${n} en @media print`).toBe(claro[n]);
    }
  });

  it("al imprimir, color-scheme vuelve a light", () => {
    expect(bloque('[data-gondola-theme="dark"]', bloque("@media print"))).toMatch(/color-scheme:\s*light/);
    expect(bloque('[data-gondola-theme="dark"]')).toMatch(/color-scheme:\s*dark/);
  });

  for (const [tema, t] of [["claro", claro], ["oscuro", oscuro]]) {
    describe(`contraste en ${tema}`, () => {
      for (const [texto, fondo, min] of PARES) {
        it(`${texto} sobre ${fondo} ≥ ${min}`, () => {
          const fg = texto.startsWith("#") ? texto : t[texto];
          const bg = t[fondo];
          expect(fg, `--g-${texto} es un hex en ${tema}`).toMatch(HEX);
          expect(bg, `--g-${fondo} es un hex en ${tema}`).toMatch(HEX);
          expect(contraste(fg, bg)).toBeGreaterThanOrEqual(min);
        });
      }
    });
  }

  it("en oscuro, la tinta clara de Coto (#16181d) se lee sobre la placa de las fotos", () => {
    expect(oscuro.plate).toMatch(HEX);
    expect(contraste("#16181d", oscuro.plate)).toBeGreaterThanOrEqual(4.5);
  });
});
