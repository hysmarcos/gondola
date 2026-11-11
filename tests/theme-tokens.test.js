import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

// Los CSS de Góndola no llevan colores escritos a mano: usan los tokens --g-* de
// src/theme.css, que cambian con el tema. Excepciones: la declaración que termina con
// /* fijo: <motivo> */ en la misma línea, y la sombra negra (rgba(0, 0, 0, …) en box-shadow).

const CSS = ["src/skin.css", "src/skin-list.css", "src/skin-pdp.css", "src/badge.css", "src/theme-coto.css"];
const COLOR = /#[0-9a-f]{3,8}\b|(?:rgba?|hsla?)\([^)]*\)/gi;
const NEGRO = /^rgba\(\s*0\s*,\s*0\s*,\s*0\s*,/i;

// Colores sueltos de un CSS, con su número de línea. Los comentarios se borran (sin
// perder las líneas), salvo la marca fijo, que exime a su línea.
function literales(css) {
  const limpio = css.replace(/\/\*[\s\S]*?\*\//g, (c) => (/^\/\*\s*fijo:\s*\S/.test(c) ? "@@FIJO@@" : c.replace(/[^\n]/g, " ")));
  const out = [];
  limpio.split("\n").forEach((linea, i) => {
    if (linea.includes("@@FIJO@@")) return;
    for (const m of linea.matchAll(COLOR)) {
      if (NEGRO.test(m[0]) && /box-shadow\s*:/.test(linea)) continue;
      out.push(`${i + 1}: ${m[0]}`);
    }
  });
  return out;
}

function definidosEnRoot() {
  const theme = readFileSync("src/theme.css", "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  const i = theme.indexOf(":root");
  const cuerpo = theme.slice(theme.indexOf("{", i) + 1, theme.indexOf("}", i));
  return new Set([...cuerpo.matchAll(/(--g-[\w-]+)\s*:/g)].map((m) => m[1]));
}

describe("literales", () => {
  it("encuentra hex, rgb y hsl; respeta la marca fijo y la sombra negra", () => {
    const css = [
      "a { color: #FFF; }",
      "b { color: #fff; /* fijo: blanco sobre el rojo */ }",
      "c { box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1); }",
      "d { background: rgba(0, 0, 0, 0.1); }",
      "e { border-color: hsl(0 0% 50%); } /* #123456 en un comentario no cuenta */",
      "#filtrosmenu { color: var(--g-ink); }",
    ].join("\n");
    expect(literales(css)).toEqual(["1: #FFF", "4: rgba(0, 0, 0, 0.1)", "5: hsl(0 0% 50%)"]);
  });
});

describe("colores de Góndola a tokens", () => {
  for (const archivo of CSS) {
    it(`${archivo}: sin colores escritos a mano`, () => {
      expect(literales(readFileSync(archivo, "utf8"))).toEqual([]);
    });
  }

  it("src/nutrition-ui.js: sin colores #hex", () => {
    expect(readFileSync("src/nutrition-ui.js", "utf8").match(/#[0-9a-f]{3,8}\b/gi) ?? []).toEqual([]);
  });

  it("toda var(--g-…) usada está definida en :root de src/theme.css", () => {
    const definidos = definidosEnRoot();
    for (const archivo of CSS) {
      const usados = [...readFileSync(archivo, "utf8").matchAll(/var\(\s*(--g-[\w-]+)/g)].map((m) => m[1]);
      expect(usados.filter((n) => !definidos.has(n)), archivo).toEqual([]);
    }
  });
});
