// Reglas de los CSS de la piel Góndola: todo cuelga de data-gondola-skin (sin el atributo,
// la página se ve como en la 0.12.0), nunca "transition: all" y ningún texto chico.
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";

const FILES = ["src/skin.css", "src/skin-list.css", "src/skin-pdp.css"].filter(existsSync);

// Parte una lista de selectores por las comas de afuera: las de :has(a, b) o :is(a, b)
// son parte de un mismo selector.
function splitSelectors(head) {
  const out = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < head.length; i++) {
    const ch = head[i];
    if (ch === "(" || ch === "[") depth++;
    else if (ch === ")" || ch === "]") depth--;
    else if (ch === "," && depth === 0) {
      out.push(head.slice(start, i).trim());
      start = i + 1;
    }
  }
  out.push(head.slice(start).trim());
  return out.filter(Boolean);
}

// Selectores de cada regla, sin comentarios ni el contenido de las llaves.
function selectors(css) {
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const out = [];
  for (const m of clean.matchAll(/([^{}]+)\{[^{}]*\}/g)) {
    const head = m[1].trim();
    if (!head || head.startsWith("@") || /^(from|to|\d+%)/.test(head)) continue;
    out.push(...splitSelectors(head));
  }
  return out;
}

describe("splitSelectors", () => {
  it("no parte en las comas de :has() ni :is()", () => {
    expect(splitSelectors('[data-gondola-skin] .a:has(.b, .c), [data-gondola-skin] :is(.d, .e) .f')).toEqual([
      "[data-gondola-skin] .a:has(.b, .c)",
      "[data-gondola-skin] :is(.d, .e) .f",
    ]);
  });

  it("no parte en las comas de un atributo", () => {
    expect(splitSelectors('[data-gondola-skin] [title="a, b"], [data-gondola-skin] .x')).toEqual([
      '[data-gondola-skin] [title="a, b"]',
      "[data-gondola-skin] .x",
    ]);
  });
});

describe.each(FILES)("%s", (file) => {
  const css = readFileSync(file, "utf8");
  it("toda regla cuelga de data-gondola-skin", () => {
    for (const sel of selectors(css)) expect(sel, sel).toMatch(/^\[data-gondola-skin/);
  });
  it("no usa transition: all", () => {
    expect(css).not.toMatch(/transition(-property)?\s*:\s*all/);
  });
  it("ningún texto baja de 11 px", () => {
    for (const m of css.matchAll(/font-size\s*:\s*(\d+(?:\.\d+)?)px/g)) expect(Number(m[1])).toBeGreaterThanOrEqual(11);
  });
});
