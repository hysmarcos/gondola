// Reglas de los CSS de la piel Góndola: todo cuelga de data-gondola-skin (sin el atributo,
// la página se ve como en la 0.12.0), nunca "transition: all" y ningún texto chico.
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { JSDOM } from "jsdom";

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

// Tamaños de texto en px: los de font-size y el primero de cada font: (el que va antes de
// la barra del interlineado: "font: 600 13px/1 Poppins").
function fontSizes(css) {
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const out = [];
  for (const m of clean.matchAll(/font-size\s*:\s*(\d+(?:\.\d+)?)px/g)) out.push(Number(m[1]));
  for (const m of clean.matchAll(/(?<![\w-])font\s*:\s*([^;}]*)/g)) {
    const size = m[1].match(/(?:^|\s)(\d+(?:\.\d+)?)px/);
    if (size) out.push(Number(size[1]));
  }
  return out;
}

describe("fontSizes", () => {
  it("lee font-size y el tamaño de font:, y no el interlineado", () => {
    expect(fontSizes("a { font-size: 12px; } b { font: 600 13px/18px Poppins !important; }")).toEqual([12, 13]);
    expect(fontSizes("a { font: 500 9px/1 Poppins; }")).toEqual([9]);
    expect(fontSizes("a { font: inherit; line-height: 14px; }")).toEqual([]);
  });
});

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

// Cuerpo de la regla con ese selector exacto (sin comentarios), o null.
function ruleBody(css, selector) {
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, "");
  for (const m of clean.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (splitSelectors(m[1].trim()).includes(selector)) return m[2];
  }
  return null;
}

it("etiquetas para vos de la tarjeta: no se achican, la caja pasa a otra fila y no recorta", () => {
  const css = readFileSync("src/skin-list.css", "utf8");
  const tag = ruleBody(css, '[data-gondola-skin="list"] .coto-unit-foryou > span');
  expect(tag).toMatch(/flex:\s*none/);
  // Último recurso: una etiqueta más ancha que toda la foto se corta con "…".
  expect(tag).toMatch(/max-width:\s*100%/);
  expect(tag).toMatch(/text-overflow:\s*ellipsis/);
  const box = ruleBody(css, '[data-gondola-skin="list"] .producto-card .top-imagen-promos > .coto-unit-foryou');
  expect(box).toMatch(/flex-wrap:\s*wrap/);
  expect(box).toMatch(/bottom:\s*8px/);
  expect(box).not.toMatch(/(?<![\w-])height\s*:/);
  expect(box).not.toMatch(/overflow\s*:\s*hidden/);
});

it("ninguna regla oculta todos los links de .bottom-botones (cuotas va con data-coto-unit-hide)", () => {
  const clean = readFileSync("src/skin-list.css", "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  const hiding = [...clean.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter((m) => /display\s*:\s*none/.test(m[2]))
    .flatMap((m) => splitSelectors(m[1].trim()))
    .filter((s) => /\.bottom-botones\s*>\s*a\s*$/.test(s));
  expect(hiding).toEqual([]);
});

// Etiqueta de nutrición: qué oculta skin-pdp.css según data-basis. Se arma la sección como la
// dibuja renderSection (tabla de 4 columnas: nombre, cada 100, porción, %VD; y la nota) y se
// mira qué celdas encuentra alguna regla con display: none.
describe("etiqueta de nutrición: columnas según data-basis", () => {
  const clean = readFileSync("src/skin-pdp.css", "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  const hiding = [...clean.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter((m) => /display\s*:\s*none/.test(m[2]))
    .flatMap((m) => splitSelectors(m[1].trim()));
  function hidden(basis) {
    const { document } = new JSDOM(`<html data-gondola-skin="pdp"><body><section class="coto-unit-nutri-section" data-skin="1" data-basis="${basis}">
      <table class="coto-unit-nutri-table"><thead><tr><th></th><th>cada 100 ml</th><th>Por porción</th><th>%VD</th></tr></thead>
      <tbody><tr><td>Valor energético</td><td>42 kcal</td><td>83 kcal</td><td>4%</td></tr></tbody></table>
      <p class="coto-unit-nutri-note">%VD</p></section></body></html>`).window;
    const parts = {
      nombre: document.querySelectorAll(":is(th, td):nth-child(1)"),
      cada100: document.querySelectorAll(":is(th, td):nth-child(2)"),
      porcion: document.querySelectorAll(":is(th, td):nth-child(3)"),
      vd: document.querySelectorAll(":is(th, td):nth-child(4)"),
      nota: document.querySelectorAll(".coto-unit-nutri-note"),
    };
    return Object.keys(parts).filter((k) => [...parts[k]].every((el) => hiding.some((s) => el.matches(s))));
  }
  it('con data-basis="100" se ocultan la porción, el %VD y su nota', () => {
    expect(hidden("100")).toEqual(["porcion", "vd", "nota"]);
  });
  it('con data-basis="portion" se oculta solo la columna de cada 100', () => {
    expect(hidden("portion")).toEqual(["cada100"]);
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
  it("ningún texto baja de 11 px (font-size y el tamaño dentro de font:)", () => {
    for (const size of fontSizes(css)) expect(size).toBeGreaterThanOrEqual(11);
  });
});
