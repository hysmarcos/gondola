# Piel Góndola en la lista y la PDP: plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Poner el diseño "Estante" en la lista de productos y en la página de producto de coto.com.ar, sin cambiar nada de lo que hace Coto y con un interruptor para apagarlo.

**Architecture:** Un atributo en `<html>` (`data-gondola-skin="list"` o `"pdp"`) prende tres hojas de estilo nuevas. Casi todo el diseño es CSS sobre los nodos que ya existen (los de Coto y los que Góndola ya dibuja). El JavaScript nuevo es chico: `skin.js` decide el atributo, y `badge.js` y `nutrition-ui.js` suman unas pocas piezas que solo aparecen con la piel prendida.

**Tech Stack:** JavaScript ES modules, Chrome Manifest V3, esbuild (`npm run build`), Vitest + jsdom (`npm test`), Playwright para capturas y medición en el sitio real.

**Spec:** `docs/superpowers/specs/2026-11-11-catalogo-pdp-rediseno-design.md`. Mockup: `docs/superpowers/specs/2026-11-11-catalogo-pdp-rediseno-mockup.html`. Si no coinciden, vale el spec.

## Global Constraints

- Góndola no borra, no clona, no reemplaza y no cambia de padre ningún nodo de Coto. El orden visual se cambia con CSS (`order`, grilla, `position`).
- Lo que sobra de Coto se oculta con `data-coto-unit-hide` (ya existe) o con una regla CSS bajo `[data-gondola-skin]`. Nunca se oculta un botón, un campo o un link que el usuario necesita, salvo "Ver planes de cuotas" en la tarjeta de la lista.
- Toda regla de `src/skin.css`, `src/skin-list.css` y `src/skin-pdp.css` empieza con `[data-gondola-skin]`, `[data-gondola-skin="list"]` o `[data-gondola-skin="pdp"]`. Excepción: `@font-face`, `@keyframes` y `@media`.
- `src/badge.css` no cambia. Con la piel apagada, la página se ve como en la versión 0.12.0.
- Nunca `transition: all`. Solo `transform`, `opacity`, `box-shadow`, `background-color`.
- Nada se anima al cargar la página. Con `prefers-reduced-motion: reduce`, solo cambios de color.
- Colores, tamaños, radios y altos: los de las secciones 3, 4.2 y 6 del spec, copiados tal cual. Altos de la tarjeta: nombre 36 px, precio 28 px, precio por unidad 20 px, comparador 33 px, acción 40 px, "sin impuestos" 18 px.
- Texto mínimo 12 px; etiquetas 11 px. Números con `font-variant-numeric: tabular-nums`.
- Ajuste: clave `skin` en `chrome.storage.local`, prendido salvo `false`. Texto del popup: título "Diseño Góndola", texto "Diseño nuevo en la lista de productos y en la página de producto. Apagalo para ver el de Coto."
- Clases nuevas de Góndola con prefijo `coto-unit-`, como el resto.
- Comentarios y textos en español, como el resto del código.
- Sin dependencias nuevas.

## Review Focus

1. **Angular todavía no dibujó la página.** El content script corre en `document_start`: al principio faltan todos los nodos. La piel no se debe apagar por eso. → test en Task 2.
2. **Productos sin etiqueta de Góndola** (sin precio por unidad): la tarjeta queda con el precio nativo de Coto. Debe verse prolija y con el botón alineado con sus vecinas. → medición en Task 3.
3. **Angular reusa nodos**: una tarjeta o una PDP pasa a mostrar otro producto. Las piezas nuevas (etiquetas "para vos", nota plegada, números grandes) no pueden quedar del producto anterior. → tests en Tasks 5, 6 y 7.
4. **Apagar la piel con la página abierta**: tiene que volver al aspecto 0.12.0 sin recargar, y sin dejar piezas nuevas a la vista. → tests en Tasks 2, 5 y 6.
5. **Zoom del navegador al 150 % y ventana angosta**: los altos fijos cortan texto. Ningún precio ni botón puede quedar cortado. → medición en Task 3.
6. **Open Food Facts responde error o tarda**: la tarjeta queda sin etiquetas "para vos", sin reintentos en cadena. → test en Task 7.

---

### Task 1: Capturar el HTML real de Coto y armar el mapa de selectores

Todo lo demás depende de esto. El spec (sección 10) dice qué partes no se inspeccionaron.

**Files:**
- Create: `scripts/capture-dom.mjs`
- Create: `tests/fixtures/dom/lista.html`, `tests/fixtures/dom/pdp.html`
- Create: `src/skin-dom.js`
- Test: `tests/skin-dom.test.js`
- Modify: `package.json` (script `"fixtures:dom": "node scripts/capture-dom.mjs"`)

**Interfaces:**
- Produces: `src/skin-dom.js` con
  - `export const DOM = { list: {...}, pdp: {...} }`: un selector CSS (string) por clave, o `null` si Coto no tiene esa parte.
  - `export const REQUIRED = { list: ["grid", "card", "centro", "buttons"], pdp: ["price", "buy"] }`: claves sin las cuales la piel no se prende.
- Claves de `DOM.list`: `grid` (contenedor de las tarjetas), `cell` (nodo entre la grilla y la tarjeta, o `null`), `card` (`.card-container`), `centro` (`.centro-precios`), `buttons` (`.bottom-botones`), `name` (`.nombre-producto`), `addButton`, `stepper`, `outOfStock`, `cuotas`, `taxLine`, `title`, `sort` (`.plp-header__sort`), `subcats`, `filters`, `filterGroup`, `filterTitle`, `filterLink`, `applied`.
- Claves de `DOM.pdp`: `columns` (contenedor de las dos columnas), `gallery`, `thumbs` (`.gallery-wrap .thumbs-wrap`), `big` (`.gallery-wrap .img-big-wrap`), `buy` (columna derecha), `title` (`.titulo-producto`), `price` (`.price`), `addButton`, `stepper`, `cuotas`, `noteForm`, `noteField`, `description` (`.pdp-description`), `features`.
- Los valores entre paréntesis ya se usan en `src/badge.js` y `src/nutrition-ui.js`; los demás salen de la captura.

- [ ] **Step 1: Escribir `scripts/capture-dom.mjs`**

Con Playwright (mirar cómo abre el sitio `scripts/capture-readme.mjs`), sin la extensión cargada. Abre una categoría (Leches) y una PDP (Leche Protein La Serenísima 1L, PLU 508911). Espera a que haya tarjetas o precio. En la lista, agrega un producto al carrito antes de guardar, para capturar el selector de cantidad. Guarda `document.body.outerHTML` sin `<script>`, sin `<style>` y sin atributos `src` de imágenes, en los dos archivos de `tests/fixtures/dom/`. Deja en la lista como máximo 8 tarjetas (recortar el resto) para que el archivo sea chico.

- [ ] **Step 2: Correr la captura**

Run: `npm run fixtures:dom`
Expected: imprime la cantidad de tarjetas guardadas (8) y el tamaño de cada archivo.

- [ ] **Step 3: Escribir el test que falla**

```js
// tests/skin-dom.test.js
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import { DOM, REQUIRED } from "../src/skin-dom.js";

const load = (f) => new JSDOM(readFileSync(`tests/fixtures/dom/${f}.html`, "utf8")).window.document;

describe.each(["list", "pdp"])("mapa de selectores: %s", (page) => {
  const doc = load(page === "list" ? "lista" : "pdp");
  it("cada selector no nulo encuentra al menos un nodo", () => {
    for (const [key, sel] of Object.entries(DOM[page])) {
      if (sel) expect(doc.querySelector(sel), `${page}.${key} = ${sel}`).not.toBeNull();
    }
  });
  it("las claves obligatorias existen y no son nulas", () => {
    for (const key of REQUIRED[page]) expect(DOM[page][key], key).toBeTruthy();
  });
});

it("en la lista, el botón y el selector de cantidad están dentro de la tarjeta", () => {
  const doc = load("lista");
  expect(doc.querySelector(`${DOM.list.card} ${DOM.list.addButton}`)).not.toBeNull();
  expect(doc.querySelector(`${DOM.list.card} ${DOM.list.stepper}`)).not.toBeNull();
});
```

- [ ] **Step 4: Correr el test y ver que falla**

Run: `npx vitest run tests/skin-dom.test.js`
Expected: FAIL, no existe `src/skin-dom.js`.

- [ ] **Step 5: Escribir `src/skin-dom.js`**

Leer los dos fixtures y completar cada clave. Preferir clases de Coto estables (nombres con significado) antes que clases de utilidad (`col-12`, `mt-3`) o atributos `_ngcontent-*`, que cambian en cada publicación de Coto. Una parte que no existe en el HTML va como `null`, con un comentario de una línea.

- [ ] **Step 6: Correr el test y ver que pasa**

Run: `npx vitest run tests/skin-dom.test.js`
Expected: PASS.

- [ ] **Step 7: Anotar lo que el HTML real no permite**

Si alguna parte del spec no se puede hacer sin cambiar de padre un nodo de Coto (por ejemplo, la columna derecha de la PDP no es un solo contenedor), escribirlo al final del spec, en la sección 10, con la simplificación elegida. No seguir con las tareas 3 a 5 sin esto.

- [ ] **Step 8: Commit**

```bash
git add scripts/capture-dom.mjs tests/fixtures/dom src/skin-dom.js tests/skin-dom.test.js package.json docs/superpowers/specs/2026-11-11-catalogo-pdp-rediseno-design.md
git commit -m "test: HTML real de la lista y la PDP de Coto, y mapa de selectores"
```

---

### Task 2: Interruptor de la piel

**Files:**
- Create: `src/skin.js`, `src/skin.css` (vacío salvo un comentario; lo llena Task 3)
- Modify: `src/badge-entry.js`, `src/popup.js` (lista `SETTINGS` y las claves de `storage.get` en `renderPopup`), `manifest.json` (`content_scripts[1].css`), `PRODUCT.md`
- Test: `tests/skin.test.js`, `tests/popup.test.js` si existe (si no, sumar el caso a `tests/skin.test.js`)

**Interfaces:**
- Consumes: `DOM`, `REQUIRED` de `src/skin-dom.js`.
- Produces:
  - `pageKind(win, doc): "list" | "pdp" | null`. `"pdp"` si `win.location.pathname` contiene `_/R-` seguido de letras, números o guiones (la misma regla `KEY_RE` de `badge.js`). `"list"` si existe `DOM.list.grid`. Si no, `null`.
  - `skinReady(doc, kind): boolean | null`. `null` si la página todavía no se dibujó (lista: no hay ninguna `DOM.list.card`; PDP: no hay `DOM.pdp.price`). Si ya se dibujó: `true` solo si están todas las claves de `REQUIRED[kind]`.
  - `installSkin(win, doc, storage, onChange = () => {})`. Pone `data-gondola-skin="<kind>"` en `doc.documentElement` cuando el ajuste está prendido, `kind` no es `null` y `skinReady` no es `false`. Si no, saca el atributo. Vuelve a decidir cuando cambia el ajuste `skin`, cuando cambia la ruta y cuando cambia el DOM (un `MutationObserver` con `childList` y `subtree`, agrupado a una vez por cuadro). Llama a `onChange()` solo cuando el valor del atributo cambió.
  - Contrato para los demás módulos: leen `doc.documentElement.getAttribute("data-gondola-skin")`.

- [ ] **Step 1: Escribir los tests que fallan**

```js
// tests/skin.test.js
import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import { installSkin, pageKind, skinReady } from "../src/skin.js";
import { DOM } from "../src/skin-dom.js";

const html = (f) => readFileSync(`tests/fixtures/dom/${f}.html`, "utf8");
function setup(body, path, stored = {}) {
  const dom = new JSDOM(`<body>${body}</body>`, { url: "https://www.coto.com.ar" + path });
  const listeners = [];
  const storage = { get: async () => stored, onChanged: { addListener: (fn) => listeners.push(fn) } };
  return { win: dom.window, doc: dom.window.document, storage, change: (c) => listeners.forEach((fn) => fn(c)) };
}
const attr = (doc) => doc.documentElement.getAttribute("data-gondola-skin");
const tick = () => new Promise((r) => setTimeout(r, 20));

describe("piel Góndola", () => {
  it("lista: pone el atributo", async () => {
    const t = setup(html("lista"), "/sitios/cdigi/categoria/x");
    installSkin(t.win, t.doc, t.storage);
    await tick();
    expect(attr(t.doc)).toBe("list");
  });
  it("PDP: pone el atributo", async () => {
    const t = setup(html("pdp"), "/sitios/cdigi/productos/leche/_/R-00508911-00508911-200");
    installSkin(t.win, t.doc, t.storage);
    await tick();
    expect(attr(t.doc)).toBe("pdp");
  });
  it("ajuste apagado: no hay atributo", async () => {
    const t = setup(html("lista"), "/x", { skin: false });
    installSkin(t.win, t.doc, t.storage);
    await tick();
    expect(attr(t.doc)).toBeNull();
  });
  it("apagar con la página abierta saca el atributo y avisa una vez", async () => {
    const t = setup(html("lista"), "/x");
    const onChange = vi.fn();
    installSkin(t.win, t.doc, t.storage, onChange);
    await tick();
    onChange.mockClear();
    t.storage.get = async () => ({ skin: false });
    t.change({ skin: { newValue: false } });
    await tick();
    expect(attr(t.doc)).toBeNull();
    expect(onChange).toHaveBeenCalledTimes(1);
  });
  it("PDP sin dibujar todavía: la piel queda prendida", async () => {
    const t = setup("<app-root></app-root>", "/p/_/R-00508911-00508911-200");
    installSkin(t.win, t.doc, t.storage);
    await tick();
    expect(skinReady(t.doc, "pdp")).toBeNull();
    expect(attr(t.doc)).toBe("pdp");
  });
  it("PDP dibujada sin la columna de compra: la piel se apaga", async () => {
    const t = setup(html("pdp"), "/p/_/R-00508911-00508911-200");
    t.doc.querySelector(DOM.pdp.buy).remove();
    // si el precio vivía adentro de la columna, se repone suelto para que cuente como dibujada
    if (!t.doc.querySelector(DOM.pdp.price)) t.doc.body.insertAdjacentHTML("beforeend", '<div class="price">$1</div>');
    installSkin(t.win, t.doc, t.storage);
    await tick();
    expect(attr(t.doc)).toBeNull();
  });
  it("página que no es lista ni PDP: sin atributo", async () => {
    const t = setup("<main>inicio</main>", "/");
    installSkin(t.win, t.doc, t.storage);
    await tick();
    expect(pageKind(t.win, t.doc)).toBeNull();
    expect(attr(t.doc)).toBeNull();
  });
});
```

- [ ] **Step 2: Correr y ver que fallan**

Run: `npx vitest run tests/skin.test.js`
Expected: FAIL, no existe `src/skin.js`.

- [ ] **Step 3: Escribir `src/skin.js`** con las tres funciones de Interfaces.

- [ ] **Step 4: Conectar en `src/badge-entry.js`**

`installSkin(window, document, chrome.storage.local, () => badges?.refresh());` después de `installBadges`.

- [ ] **Step 5: Sumar el ajuste al popup y el CSS al manifest**

En `src/popup.js`: una fila más en `SETTINGS`, primera de la lista, con la clave y los textos de Global Constraints, y `"skin"` en las claves de `storage.get`. En `manifest.json`: `"css": ["src/badge.css", "src/skin.css"]`. Test: el popup dibuja un interruptor con `name` o clave `skin`, marcado si el valor guardado no es `false`.

- [ ] **Step 6: Actualizar `PRODUCT.md`**

Los dos cambios de la sección 7 del spec. Sacar la frase "Coto pages keep Coto's look." y la frase "Visually close to Coto (Coto red, Poppins) so it feels at home on the site."; poner en su lugar las dos del spec, en inglés como el resto del archivo. En "Capabilities and Constraints", dejar la regla de no borrar ni romper la interfaz de Coto y sumar: restyles list and product pages with CSS; never re-parents Coto's controls.

- [ ] **Step 7: Correr todo**

Run: `npm test` y después `npm run build`
Expected: todos los tests pasan; el build termina sin errores.

- [ ] **Step 8: Commit**

```bash
git add src/skin.js src/skin.css src/badge-entry.js src/popup.js manifest.json PRODUCT.md tests/skin.test.js
git commit -m "feat: interruptor de la piel Góndola (atributo data-gondola-skin)"
```

---

### Task 3: Tarjeta de la lista

Solo CSS, más un script que mide en el sitio real.

**Files:**
- Modify: `src/skin.css` (tokens y piezas comunes)
- Create: `src/skin-list.css`
- Create: `scripts/skin-check.mjs`
- Create: `tests/skin-css.test.js`
- Modify: `manifest.json` (sumar `src/skin-list.css`), `package.json` (script `"skin:check": "node scripts/skin-check.mjs"`)

**Interfaces:**
- Consumes: los selectores de `DOM.list`; las clases que ya dibuja `badge.js` en la tarjeta: `.coto-unit-price` (bloque) con `.coto-unit-pricerow` (`.coto-unit-final`, `.coto-unit-regular`), `.coto-unit-detail`, `.coto-unit-cmprow` (pastilla del comparador y su panel) y `.coto-unit-unit` (`.coto-unit-value`); `.coto-unit-tags` sobre la foto con `.coto-unit-best`, `.coto-unit-offer`, `.coto-unit-mark`; el atributo `data-coto-unit-card` en la tarjeta con etiqueta.
- Produces: variables CSS en `[data-gondola-skin]`: `--g-ink`, `--g-ink2`, `--g-line`, `--g-soft`, `--g-red`, `--g-red-d`, `--g-navy`, `--g-navy-soft`, `--g-amber`, `--g-amber-soft`, `--g-amber-ink`, `--g-green`, `--g-green-soft`, `--g-out` (la curva). Las usan Tasks 4 a 7.

- [ ] **Step 1: Escribir el test de reglas CSS**

```js
// tests/skin-css.test.js
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";

const FILES = ["src/skin.css", "src/skin-list.css", "src/skin-pdp.css"].filter(existsSync);
// Selectores de cada regla, sin comentarios ni el contenido de las llaves.
function selectors(css) {
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const out = [];
  for (const m of clean.matchAll(/([^{}]+)\{[^{}]*\}/g)) {
    const head = m[1].trim();
    if (!head || head.startsWith("@") || /^(from|to|\d+%)/.test(head)) continue;
    out.push(...head.split(",").map((s) => s.trim()));
  }
  return out;
}

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
```

- [ ] **Step 2: Correr y ver el estado**

Run: `npx vitest run tests/skin-css.test.js`
Expected: PASS vacío para `src/skin.css` (todavía sin reglas). Sirve de red para los pasos siguientes.

- [ ] **Step 3: Tokens y piezas comunes en `src/skin.css`**

Las variables de Interfaces con los valores de la sección 3 del spec. Estilo del botón "Agregar" y del selector de cantidad de Coto (`DOM.list.addButton`, `DOM.list.stepper` y los de la PDP): alto 40 px, radio 10 px, rojo `--g-red`, `scale(0.97)` al apretar en 160 ms, zona de toque de 40 × 40 px en `−` y `+`. El hover va dentro de `@media (hover: hover) and (pointer: fine)`. El bloque `@media (prefers-reduced-motion: reduce)` anula `transform` y `animation`.

- [ ] **Step 4: La tarjeta en `src/skin-list.css`**

Bajo `[data-gondola-skin="list"]`. Tabla de la sección 4.2 del spec. Decisiones que el spec no fija:

- El bloque `.coto-unit-price` pasa a grilla de dos columnas: fila 1, `.coto-unit-pricerow` a lo ancho (28 px); fila 2, `.coto-unit-unit` a la izquierda y `.coto-unit-detail` a la derecha (20 px, una línea, "…" si no entra); fila 3, `.coto-unit-cmprow` a lo ancho (33 px, con la línea fina arriba). Así el motivo queda al lado del precio por unidad sin tocar `badge.js`.
- La pastilla del comparador ocupa todo el ancho de su fila, sin fondo, con el punto de color a la izquierda. Su panel conserva el contenido actual; cambia a `position: absolute` sobre la tarjeta, con sombra, origen abajo a la izquierda y la entrada de 150 ms de la sección 6 del spec.
- En `.coto-unit-tags` se ve una sola de `.coto-unit-best` y `.coto-unit-offer` (la primera que exista); `.coto-unit-mark` (inicio de grupo al ordenar por unidad) se sigue viendo siempre, debajo.
- En el carrito: `DOM.list.card:has(DOM.list.stepper)` lleva el borde rojo de 2 px. Sin stock: `DOM.list.card:has(DOM.list.outOfStock)` atenúa la foto. Si alguno de esos selectores es `null` en `src/skin-dom.js`, esa regla no se escribe.
- `DOM.list.cuotas` dentro de la tarjeta: `display: none`. `DOM.list.taxLine`: 12 px, gris, 18 px de alto, debajo del botón (con `order`).
- Tarjeta sin `data-coto-unit-card` (sin etiqueta de Góndola): mismo borde, radio y foto; el precio nativo de Coto en 20 px y peso 600; el botón pegado abajo con `margin-top: auto`. No se le fijan altos internos.
- La tarjeta ocupa todo el alto de su celda de la grilla, para que las de una misma fila midan lo mismo aunque una no tenga etiqueta.

- [ ] **Step 5: Escribir `scripts/skin-check.mjs`**

Con Playwright, en el sitio real. Reusar la forma de inyectar `dist/` de `scripts/capture-readme.mjs` y sumar los CSS de la piel. Abre la categoría Leches, espera las etiquetas de Góndola y mide, por cada fila de la grilla: el `top` del nombre, del precio, del botón, y el alto de cada tarjeta. Lo repite a 1280 × 900, 1920 × 1080 y a 1280 × 900 con zoom de página 1,5. Falla (código de salida 1) si en alguna fila:

- dos tarjetas con `data-coto-unit-card` difieren en más de 1 px en cualquiera de esas medidas;
- el botón de una tarjeta sin `data-coto-unit-card` difiere en más de 1 px del de sus vecinas;
- el `scrollWidth` del precio o del botón es mayor que su `clientWidth` (texto cortado).

Imprime una línea por tamaño: `1280x900: 6 filas, alineadas` o la lista de diferencias.

- [ ] **Step 6: Construir y medir**

Run: `npm run build` y después `npm run skin:check`
Expected: las tres líneas dicen "alineadas". Si una fila no tiene ninguna tarjeta sin etiqueta, el script lo avisa; en ese caso correrlo también sobre una búsqueda mixta (por ejemplo "pack") para cubrir el punto 2 de Review Focus.

- [ ] **Step 7: Probar a mano que Coto sigue andando**

Con la extensión cargada desde la carpeta principal del repo (no desde el worktree): agregar un producto, sumar, restar hasta cero. El mini-carrito y el total coinciden con lo que se hizo. Apagar la piel en el popup: la lista vuelve al aspecto anterior sin recargar.

- [ ] **Step 8: Correr todo y commit**

Run: `npm test`
Expected: PASS.

```bash
git add src/skin.css src/skin-list.css scripts/skin-check.mjs tests/skin-css.test.js manifest.json package.json
git commit -m "feat: tarjeta de la lista con la piel Góndola y filas parejas"
```

---

### Task 4: Página de la lista (grilla, filtros, subcategorías, orden)

Solo CSS.

**Files:**
- Modify: `src/skin-list.css`, `scripts/skin-check.mjs`

**Interfaces:**
- Consumes: `DOM.list.grid`, `cell`, `title`, `sort`, `subcats`, `filters`, `filterGroup`, `filterTitle`, `filterLink`, `applied`; las variables `--g-*` de Task 3.

- [ ] **Step 1: Sumar la medición de la página a `scripts/skin-check.mjs`**

A 1280 × 900: 4 tarjetas por fila; a 1000 × 800: 3 por fila. La columna de filtros mide 184 px de ancho (más o menos 2 px). Después de bajar 1500 px, el `top` de la columna de filtros sigue dentro de la ventana (queda fija). Ningún nodo de la lista tiene `scrollWidth` mayor que el de la ventana (sin barra horizontal).

- [ ] **Step 2: Correr y ver que falla**

Run: `npm run build` y después `npm run skin:check`
Expected: FAIL en las mediciones nuevas.

- [ ] **Step 3: Escribir el CSS de la sección 4.1 del spec**

Decisiones que el spec no fija:

- Si `DOM.list.cell` no es `null`, la grilla se arma sobre `DOM.list.grid` y cada celda estira su tarjeta al alto de la fila. No usar `display: contents` en nodos de Coto.
- La columna de filtros queda fija con `position: sticky; top: <alto del encabezado fijo de Coto + 12px>` y, si es más alta que la ventana, con `max-height` y `overflow-y: auto`.
- La casilla de cada filtro es un `::before` de 14 px sobre el link. El filtro activo se reconoce por la clase o atributo que use Coto (verlo en el fixture); si Coto no lo marca, todas las casillas van vacías y no se dibuja nada más.
- Las clases o partes que sean `null` en `src/skin-dom.js` se saltean sin reemplazo (por ejemplo, sin `applied` no hay fila de filtros aplicados).
- Links de filtro, chips y selector de orden: texto `--g-ink`, 12 px. El rojo de Coto se saca de todos ellos.

- [ ] **Step 4: Construir y medir**

Run: `npm run build` y después `npm run skin:check`
Expected: todas las mediciones pasan, incluidas las de Task 3.

- [ ] **Step 5: Probar a mano**

Aplicar un filtro, sacarlo, cambiar el orden (incluido "precio por kg/L" de Góndola), pasar de página. Repetir en una búsqueda y en la página de ofertas. En las tres, el resultado es el mismo que con la piel apagada.

- [ ] **Step 6: Commit**

```bash
git add src/skin-list.css scripts/skin-check.mjs
git commit -m "feat: grilla, filtros y barra de orden con la piel Góndola"
```

---

### Task 5: Página de producto: estructura y caja de compra

**Files:**
- Create: `src/skin-pdp.css`
- Modify: `src/badge.js` (`renderPdp`, `paintBox`, el manejo de `settings`), `manifest.json` (sumar `src/skin-pdp.css`), `scripts/skin-check.mjs`
- Test: `tests/skin-pdp.test.js`

**Interfaces:**
- Consumes: `DOM.pdp`; `data-gondola-skin`; `formatBlocked`, `dayName`, el objeto `label` de `badge.js` (`bankPrice`, `bankName`, `bankPercent`, `bankBlocked`).
- Produces, exportadas desde `src/badge.js`:
  - `formatBankBox(label, hasBank, day, today): { kind: "apply" | "blocked" | "none", text: string } | null`
    - `hasBank` es `false` → `{ kind: "none", text: "Elegí tus tarjetas en el botón de Góndola y vas a ver el precio con el descuento de cada día." }`
    - `label.bankPrice != null` y hay `label.bankName` → `{ kind: "apply", text: "<banco> <cuándo>: <porcentaje>% · <precio con 2 decimales>" }`, con `<cuándo>` = `hoy` o `el <día en minúscula>`, igual que `formatWhy`. Ejemplo: `ICBC hoy: 10% · $1.816,20`.
    - `label.bankBlocked` con texto en `formatBlocked` → `{ kind: "blocked", text: ese texto }`
    - cualquier otro caso → `null`
  - Nodos nuevos, solo con `data-gondola-skin="pdp"`:
    - `.coto-unit-bankbox` dentro de `.coto-unit-box`, con `.coto-unit-bankbox-title` ("Con tu banco") y `.coto-unit-bankbox-text`.
    - `.coto-unit-cmptitle` ("El mismo producto en otros súper") antes de las filas del comparador, solo si hay filas.
    - `button.coto-unit-note-toggle` ("Agregar una nota o un reemplazo"), hermano anterior de `DOM.pdp.noteForm`, con `aria-expanded`. El formulario lleva `data-gondola-note="open" | "closed"`.

- [ ] **Step 1: Escribir los tests que fallan**

```js
// tests/skin-pdp.test.js (usar el `setup` de tests/badge.test.js como modelo)
import { describe, it, expect } from "vitest";
import { formatBankBox } from "../src/badge.js";

describe("caja Con tu banco", () => {
  const bank = { bankPrice: 1816.2, bankName: "ICBC", bankPercent: 10 };
  it("sin tarjetas elegidas, invita a elegir", () => {
    expect(formatBankBox({}, false, 4, 4)).toEqual({ kind: "none", text: "Elegí tus tarjetas en el botón de Góndola y vas a ver el precio con el descuento de cada día." });
  });
  it("con promo hoy", () => {
    expect(formatBankBox(bank, true, 4, 4)).toEqual({ kind: "apply", text: "ICBC hoy: 10% · $1.816,20" });
  });
  it("con promo otro día", () => {
    expect(formatBankBox(bank, true, 4, 2).text).toBe("ICBC el jueves: 10% · $1.816,20");
  });
  it("banco que no aplica", () => {
    expect(formatBankBox({ bankBlocked: "oferta" }, true, 4, 4)).toEqual({ kind: "blocked", text: "Banco no aplica: ya está en oferta" });
  });
  it("con tarjetas pero sin promo para este producto: nada", () => {
    expect(formatBankBox({}, true, 4, 4)).toBeNull();
  });
});
```

Y, con el fixture `tests/fixtures/dom/pdp.html`, `installBadges` y un mensaje `labels` para la PDP:

- con `data-gondola-skin="pdp"`: existe `.coto-unit-bankbox`; el comparador se dibuja en filas (hay `.coto-unit-cmp-row`) y lo precede `.coto-unit-cmptitle`; existe `button.coto-unit-note-toggle` y `DOM.pdp.noteForm` tiene `data-gondola-note="closed"`;
- un click en el botón deja `data-gondola-note="open"` y `aria-expanded="true"`;
- si `DOM.pdp.noteField` ya tiene texto, arranca en `"open"`;
- sin el atributo de la piel: no existe ninguno de los tres nodos nuevos, el formulario no tiene `data-gondola-note` y el comparador vuelve a la pastilla (no hay `.coto-unit-cmp-row`);
- sacar el atributo y llamar a `refresh()` borra los tres nodos nuevos (Review Focus 4);
- el formulario, su campo y sus botones siguen siendo los mismos nodos, con el mismo padre, antes y después (comparar por identidad);
- cambiar la ruta a otra PDP y mandar la etiqueta del producto nuevo: `.coto-unit-bankbox-text` muestra el banco del producto nuevo (Review Focus 3).

- [ ] **Step 2: Correr y ver que fallan**

Run: `npx vitest run tests/skin-pdp.test.js`
Expected: FAIL, `formatBankBox` no existe.

- [ ] **Step 3: Cambios en `src/badge.js`**

- `formatBankBox` según Interfaces.
- En el manejo de `settings`: guardar `state.hasBank = (m.selected ?? []).length > 0`.
- En `paintBox`, variante `"pdp"`: si la piel es `"pdp"`, pasar `"rows"` a `paintCmp` en lugar de `"icon"`, y dibujar `.coto-unit-bankbox` y `.coto-unit-cmptitle`. Si no, borrarlos. Usar `upsert` y `order`, como el resto de la caja, para no disparar el observador en cada vuelta.
- Función nueva `paintNote()` llamada desde `renderPdp`: crea o borra el botón y el atributo. El estado abierto o cerrado que eligió el usuario se conserva entre repintados; se reinicia cuando cambia la clave de la PDP.

- [ ] **Step 4: Correr los tests**

Run: `npx vitest run tests/skin-pdp.test.js tests/badge.test.js tests/compare-ui.test.js`
Expected: PASS, incluidos los tests viejos.

- [ ] **Step 5: Escribir `src/skin-pdp.css`** (secciones 5.1 y 5.2 del spec)

Decisiones que el spec no fija:

- La columna derecha es `DOM.pdp.buy`: 380 px, `position: sticky` bajo el encabezado de Coto, borde de 1 px por `box-shadow`, radio 16 px, relleno 20 px. Si es más alta que la ventana, no se fija (`@media (max-height: 760px)` la deja estática).
- El orden interno de la caja se arma con `display: flex; flex-direction: column` y `order` sobre los hijos directos de `DOM.pdp.buy`. Los hijos que el spec no nombra quedan al final, en su orden original.
- `.coto-unit-cap` ("Precio real para comparar") y `.coto-unit-bankno` se ocultan con la piel: los reemplazan el precio por unidad y `.coto-unit-bankbox`.
- `.coto-unit-bankbox` y el comparador: una línea fina arriba, sin fondo. Título en `--g-navy`, 12 px, peso 600.
- Filas del comparador: sin barras de proporción (el mockup las muestra; `compare-ui.js` no las dibuja y no se agregan). Nombre a la izquierda, precio a la derecha; la más barata en `--g-green` y peso 600.
- `[data-gondola-note="closed"]` oculta el formulario con `display: none`. El botón se ve como un link gris subrayado de 12 px.
- Por debajo de 820 px de ancho: una columna, con la caja de compra primero (`order: -1`).

- [ ] **Step 6: Medir en el sitio real**

Sumar a `scripts/skin-check.mjs`, en la PDP de PLU 508911 a 1280 × 900: la caja de compra mide 380 px de ancho (más o menos 2 px); después de bajar 600 px, su `top` sigue en la ventana; su `bottom` nunca pasa del `top` del pie de página; no hay barra horizontal.

Run: `npm run build` y después `npm run skin:check`
Expected: pasan todas las mediciones.

- [ ] **Step 7: Probar a mano**

En la PDP: agregar, sumar, restar. Abrir la nota, escribir, guardar, recargar (arranca abierta), borrar. Abrir "Ver planes de cuotas". Todo igual que con la piel apagada.

- [ ] **Step 8: Commit**

```bash
git add src/skin-pdp.css src/badge.js manifest.json scripts/skin-check.mjs tests/skin-pdp.test.js
git commit -m "feat: PDP con caja de compra fija, banco y otros súper"
```

---

### Task 6: Nutrición y descripción con estilo "etiqueta"

**Files:**
- Modify: `src/nutrition-ui.js` (`createNutritionUi`, `renderSection`), `src/badge-entry.js`, `src/skin-pdp.css`
- Test: `tests/nutrition-ui.test.js` (casos nuevos al final)

**Interfaces:**
- Consumes: el resultado de nutrición de `src/nutrition.js` (leer ahí las claves de `per100` y de la porción); `data-gondola-skin`.
- Produces:
  - `createNutritionUi(doc, { request, onUpdate, iconUrl, assetUrl, skin = () => false })`: opción nueva `skin`, una función que devuelve `true` cuando la piel de la PDP está prendida. `badge-entry.js` le pasa `() => document.documentElement.getAttribute("data-gondola-skin") === "pdp"`.
  - `export function tileItems(n, basis, liquid): Array<[valor: string, leyenda: string]>`. `basis` es `"100"` o `"portion"`. Hasta cuatro, en este orden: calorías, proteínas, azúcares, sodio. Se saltea el que no tenga dato. Leyenda de calorías: `kcal cada 100 g`, `kcal cada 100 ml` o `kcal por porción`. Las otras: `proteínas`, `azúcares`, `sodio`. Los valores usan el mismo formato que la tabla (`format`).
  - Con la piel prendida, la sección `.coto-unit-nutri-section` suma, antes de la tabla: `.coto-unit-nutri-seg` (dos `button` con `aria-pressed`: "Cada 100 g" o "Cada 100 ml", y "Por porción"; solo si el resultado tiene porción) y `.coto-unit-nutri-tiles`. La sección lleva `data-basis="100" | "portion"` y `data-skin="1"`.

- [ ] **Step 1: Escribir los tests que fallan** (en `tests/nutrition-ui.test.js`, con los fixtures que ya usa ese archivo)

- `tileItems(n, "100", true)` con el fixture de leche: cuatro ítems; el primero termina en `kcal cada 100 ml`.
- `tileItems(n, "portion", true)`: los valores son los de la porción; el primero termina en `kcal por porción`.
- `tileItems` con una tabla sin proteínas ni sodio: dos ítems.
- Con `skin: () => true`: la sección tiene `.coto-unit-nutri-tiles` con cuatro hijos y `.coto-unit-nutri-seg` con dos botones; `data-basis="100"`.
- Click en "Por porción": `data-basis="portion"`, el botón queda con `aria-pressed="true"` y los números grandes cambian.
- Resultado sin porción: no hay `.coto-unit-nutri-seg`; los números grandes están.
- Resultado `"missing"`: no hay números grandes ni interruptor (queda el aviso de siempre).
- Con `skin: () => false`: no hay `.coto-unit-nutri-tiles` ni `.coto-unit-nutri-seg`, y el HTML de la sección es igual al de antes de este cambio.
- Cambiar `skin` de `true` a `false` y volver a llamar a `paint`: la sección se rehace sin las piezas nuevas (Review Focus 4).
- Llamar a `paint` con la etiqueta de otro producto: los números grandes son los del producto nuevo y `data-basis` vuelve a `"100"` (Review Focus 3).

- [ ] **Step 2: Correr y ver que fallan**

Run: `npx vitest run tests/nutrition-ui.test.js`
Expected: FAIL en los casos nuevos; los viejos pasan.

- [ ] **Step 3: Implementar en `src/nutrition-ui.js`**

La sección se rehace cuando cambia el valor de `skin()`, igual que hoy se rehace cuando cambia `data-tacc`. El click del interruptor cambia `data-basis` y vuelve a dibujar solo `.coto-unit-nutri-tiles`; la tabla no se rehace (la columna que no corresponde la oculta el CSS).

- [ ] **Step 4: Correr los tests**

Run: `npx vitest run tests/nutrition-ui.test.js`
Expected: PASS.

- [ ] **Step 5: CSS de las secciones 5.3 y 5.4 del spec, en `src/skin-pdp.css`**

Decisiones que el spec no fija:

- La "etiqueta" es la tabla existente con el título, la línea de envase y la nota de %VD que ya dibuja `renderSection`. Se agrupan con una grilla en la sección: columna izquierda de 300 px con esos nodos, columna derecha con los números grandes, alérgenos, Sin TACC, NOVA, ingredientes y fuente. El borde negro de 2 px va en la columna izquierda con un `::before` de la sección posicionado detrás, para no envolver nodos.
- `[data-basis="100"]` oculta la columna "por porción" de la tabla; `[data-basis="portion"]` oculta la de "cada 100". La columna %VD se ve siempre.
- La línea de resumen de la columna de compra (`.coto-unit-nutri-sum`) y "Para vos" (`.coto-unit-nutri-foryou`) siguen en la caja de compra, entre el comparador y "Ver planes de cuotas". "Para vos" pasa a etiquetas: verde para `ok`, ámbar para `warn` y `danger`, gris para `unknown` e `info`.
- Descripción: `DOM.pdp.description` con texto de 14 px y `max-width: 60ch`. Características (`DOM.pdp.features`): barra negra de 6 px arriba, línea negra de 1 px entre filas, 3 px abajo; el nombre de cada dato en peso 600 y 150 px de ancho. Si `DOM.pdp.features` es `null`, esta parte no se hace.
- Por debajo de 1100 px de ancho de ventana, la sección de nutrición pasa a una columna.

- [ ] **Step 6: Construir, medir y mirar**

Run: `npm test`, `npm run build`, `npm run skin:check`
Expected: todo pasa. Mirar a mano tres PDP: una con tabla completa (PLU 508911), una sin tabla en Open Food Facts y una que no es comida (sin sección).

- [ ] **Step 7: Commit**

```bash
git add src/nutrition-ui.js src/badge-entry.js src/skin-pdp.css tests/nutrition-ui.test.js
git commit -m "feat: nutrición y ficha de la PDP con estilo etiqueta"
```

---

### Task 7: Etiquetas "para vos" en la tarjeta de la lista

Esta es la única tarea que pide datos nuevos: una consulta a Open Food Facts por cada tarjeta que entra en pantalla. Se puede dejar afuera sin afectar a las demás (ver "Cambio respecto del spec").

**Files:**
- Modify: `src/nutrition-ui.js`, `src/badge.js` (`renderCards`), `src/skin-list.css`
- Test: `tests/nutrition-ui.test.js`, `tests/badge.test.js` (casos nuevos al final)

**Interfaces:**
- Consumes: `taccStatus` de `src/tacc.js`; `ALLERGENS` de `src/nutrition.js`; el perfil que `createNutritionUi` ya guarda con `setProfile`.
- Produces:
  - `export function cardTagItems(profile, label, n): Array<[kind: "danger" | "warn" | "ok", text: string]>`, como máximo 2, en este orden de prioridad:
    1. por cada alergia del perfil que `n.allergens` declara: `["danger", "Tiene <alérgeno en minúscula>"]`
    2. por cada alergia del perfil que está en `n.traces`: `["warn", "Puede tener <alérgeno en minúscula>"]`
    3. perfil celíaco y `taccStatus(label.tacc ?? null, label.name, n).kind === "warn"`: `["warn", "Revisá TACC"]`
    4. perfil celíaco y `kind === "ok"`: `["ok", "Sin TACC"]`
    `n` puede ser `null` (sin tabla): entonces solo aplican 3 y 4. Sin perfil, o perfil con todo apagado: `[]`. Sodio y azúcar no generan etiqueta en la tarjeta (sería calcular un sello).
  - En el objeto que devuelve `createNutritionUi`:
    - `wantsCards(): boolean` → `true` si el perfil tiene celíaco prendido o alguna alergia.
    - `cardTags(label): Array | undefined` → `undefined` si el resultado de ese EAN todavía no está (ni pedido ni llegado); si está, `cardTagItems(...)` (con `n = null` para `"missing"` y `"error"`).
    - `request(ean): void` → pide el EAN una sola vez; al llegar llama a `onUpdate`. Un `"error"` no se reintenta en la misma página.
  - En la tarjeta: `.coto-unit-foryou` dentro del área de la foto, con un `span.coto-unit-foryou-<kind>` por etiqueta y `data-coto-unit-ean`.

- [ ] **Step 1: Escribir los tests que fallan**

`cardTagItems`:

```js
const milk = { allergens: ["milk"], traces: ["soybeans"] };
expect(cardTagItems({ allergens: ["milk", "soybeans"] }, {}, milk)).toEqual([["danger", "Tiene leche"], ["warn", "Puede tener soja"]]);
expect(cardTagItems({ celiac: true, allergens: [] }, { tacc: "SI", name: "Leche" }, null)).toEqual([["ok", "Sin TACC"]]);
expect(cardTagItems({ celiac: true, allergens: [] }, { tacc: "SI", name: "Avena tradicional" }, null)).toEqual([["warn", "Revisá TACC"]]);
expect(cardTagItems({ celiac: true, allergens: ["milk", "soybeans"] }, { tacc: "SI", name: "Leche" }, milk)).toHaveLength(2);
expect(cardTagItems({ celiac: false, allergens: [], sodium: true, sugar: true }, {}, milk)).toEqual([]);
expect(cardTagItems(null, {}, milk)).toEqual([]);
```

(Los nombres en minúscula salen de `ALLERGENS`; ajustar "leche" y "soja" a lo que diga ese mapa.)

En `tests/badge.test.js`, con una lista de dos tarjetas, la piel `"list"` y un `nutrition` de prueba:

- perfil vacío (`wantsCards()` es `false`): no se pide ningún EAN y no hay `.coto-unit-foryou`;
- perfil con alergia a la leche, sin `IntersectionObserver` en la ventana de prueba: se pide cada EAN una vez; al llegar el resultado y llamar a `refresh()`, la tarjeta tiene `.coto-unit-foryou` con `.coto-unit-foryou-danger` y el texto "Tiene leche";
- producto que no es comida (`label.nutri` falso): no se pide;
- sin la piel: no se pide nada y no hay `.coto-unit-foryou`;
- el pedido devuelve `"error"`: no hay etiquetas y, después de tres repintados, el EAN se pidió una sola vez (Review Focus 6);
- la tarjeta pasa a mostrar otro producto (cambia el `href` del link): las etiquetas del anterior desaparecen en ese mismo repintado (Review Focus 3);
- apagar la piel y llamar a `refresh()`: desaparecen (Review Focus 4).

- [ ] **Step 2: Correr y ver que fallan**

Run: `npx vitest run tests/nutrition-ui.test.js tests/badge.test.js`
Expected: FAIL en los casos nuevos.

- [ ] **Step 3: Implementar**

En `badge.js`, una función `paintForYou(card, label)` llamada desde `renderCards` después de `paintTags`. Para pedir solo lo que se ve, generalizar `want(box, ean)` para que reciba la función a llamar (`ask` del comparador o `nutrition.request`), con un `WeakMap` propio por uso; el `IntersectionObserver` se puede compartir. El pedido pasa por el mismo mensaje `nutrition` al service worker, que ya limita a 4 pedidos a la vez y guarda 7 días.

- [ ] **Step 4: Correr los tests**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: CSS en `src/skin-list.css`**

`.coto-unit-foryou`: abajo de la foto, una fila, 26 px de alto, lo que no entra se corta con "…". Colores: `ok` verde suave, `warn` y `danger` ámbar suave con texto `--g-amber-ink`; `danger` con peso 600 y un borde de 1 px `--g-amber`. No cambia el alto de la tarjeta.

- [ ] **Step 6: Medir y probar a mano**

Run: `npm run build` y después `npm run skin:check`
Expected: las filas siguen alineadas.

A mano: en el popup, marcar alergia a la leche y entrar a Leches. Las etiquetas aparecen en las tarjetas visibles. En la pestaña Red del navegador, los pedidos a `world.openfoodfacts.org` son uno por producto visto, y no se repiten al recargar la página.

- [ ] **Step 7: Actualizar el texto de ayuda y la privacidad**

En `src/popup.js`, fila "Mi perfil" de `HELP`: agregar "En la lista, marca los productos que tienen tus alergias." En `site/privacidad.html`, donde hoy dice cuándo se consulta Open Food Facts: sumar que, con el perfil cargado, también se consulta por los productos de la lista que se ven en pantalla (solo el código de barras).

- [ ] **Step 8: Commit**

```bash
git add src/nutrition-ui.js src/badge.js src/skin-list.css src/popup.js site/privacidad.html tests/nutrition-ui.test.js tests/badge.test.js
git commit -m "feat: etiquetas para vos en las tarjetas de la lista"
```

---

### Task 8: Cierre

**Files:**
- Modify: `manifest.json` y `package.json` (versión `0.13.0`), `README.md` y `README.en.md` (una línea en la lista de funciones), `docs/chrome-web-store.md` si describe el aspecto de la página

- [ ] **Step 1: Subir la versión a 0.13.0** en `manifest.json` y `package.json`.

- [ ] **Step 2: Correr todo**

Run: `npm test`, `npm run build`, `npm run package`, `npm run skin:check`
Expected: todo pasa; el ZIP incluye los tres CSS nuevos.

- [ ] **Step 3: Pasar la lista de pruebas manuales** de la sección 9 del spec (los 7 puntos), con la piel prendida y apagada, cargando la extensión desde la carpeta principal del repo. Anotar en el mensaje del commit cualquier punto que no se pudo probar.

- [ ] **Step 4: Sumar la función a los README** con una línea: diseño nuevo de la lista y la página de producto, que se puede apagar.

- [ ] **Step 5: Commit**

```bash
git add manifest.json package.json README.md README.en.md docs/chrome-web-store.md
git commit -m "chore: versión 0.13.0 con la piel Góndola"
```

---

## Cambio respecto del spec

Al leer el código salieron cuatro diferencias. El spec ya está corregido (commit junto con este plan):

1. **Etiquetas "para vos" en la tarjeta.** El spec decía que no había datos nuevos. No es así: hoy la nutrición se pide solo en la PDP. Task 7 pide un producto a Open Food Facts cuando su tarjeta entra en pantalla, solo si el perfil tiene celíaco o alergias. Sodio y azúcar no generan etiqueta en la tarjeta.
2. **Banco en la PDP.** En las reglas reales de Coto, un producto en oferta no suma descuento de banco: el caso "banco contra llevando 2" del mockup no existe. La caja muestra el descuento que aplica, o "Banco no aplica", o la invitación a elegir tarjetas. No hay link "Cambiar": una página no puede abrir el popup de la extensión.
3. **Textos del comparador.** Se usan los que ya dibuja `compare-ui.js` ("Mejor precio", "Más barato en Más", "Igual", "Comparando…", "Sin comparar") y su panel actual. En la PDP las filas no llevan barras.
4. **Etiqueta de arriba en la foto.** Se ve una sola entre "más barato" y la oferta. La marca de inicio de grupo al ordenar por unidad se sigue viendo.
