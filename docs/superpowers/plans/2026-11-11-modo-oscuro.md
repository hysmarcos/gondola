# Modo oscuro en el sitio de Coto: plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Góndola suma un modo oscuro para todo coto.com.ar, elegible desde el popup (Claro, Oscuro, Automático), con una onda animada al cambiar y el logo de Coto de rojo a negro.

**Architecture:** Un módulo nuevo (`src/theme.js`) pone `data-gondola-theme="dark"` en `<html>`. Los tokens `--g-*` pasan a `:root` en `src/theme.css` y se redefinen bajo ese atributo; los CSS de Góndola dejan de tener colores escritos a mano. `src/theme-coto.css` pinta las partes de Coto. La onda usa la View Transitions API.

**Tech Stack:** JavaScript (módulos ES, sin framework), CSS, esbuild, Vitest + jsdom, Playwright para capturas y revisión. Chrome MV3 (target `chrome120`).

**Spec:** `docs/superpowers/specs/2026-11-11-modo-oscuro-design.md`. Leelo entero antes de empezar: la tabla de tokens y sus valores están ahí.

## Global Constraints

- Clave de storage: `theme`. Valores válidos: `"light"`, `"dark"`, `"auto"`. Cualquier otro valor, o ninguno, vale `"light"`.
- Atributo: `data-gondola-theme="dark"` en `<html>`. En claro, el atributo no existe.
- Caché: `localStorage["gondola-theme"]`, con `"dark"` o `"light"`.
- Clase temporal de la onda: `gondola-theme-wave` en `<html>`.
- Onda: `clip-path: circle(0% at 100% 0%)` → `circle(150% at 100% 0%)`, 650 ms, `cubic-bezier(0.23, 1, 0.32, 1)`.
- Valores de los tokens: la tabla del spec, copiados tal cual.
- Contraste: 4,5:1 en texto normal; 3:1 en texto grande y bordes de controles.
- Nunca se mueve ni se borra un nodo de Coto. Solo un atributo en `<html>`, una clase temporal y CSS.
- Sobre nodos de Coto, lo que choca con sus estilos lleva `!important` (norma de `src/skin.css`).
- Textos en español rioplatense, cortos. Comentarios de código en español, como el resto del repo.
- El popup y la bienvenida siguen claros: no se tocan sus colores.
- Sin dependencias nuevas.
- Mensajes de commit: `feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`. Sin líneas de atribución.

## Review Focus

1. `theme` guardado con basura (`true`, `"DARK"`, `null`): la página queda clara y no hay error. → Task 1.
2. `localStorage` tira un error (bloqueado por el navegador): `installTheme` no rompe y el resto de la extensión se instala. → Task 1.
3. La caché dice `dark` y el ajuste dice `light` al abrir la página: se corrige sin onda. → Task 1.
4. Dos cambios seguidos, con la onda en curso: el atributo final es el del último cambio y la clase `gondola-theme-wave` se saca. → Task 1.
5. Imprimir con el modo oscuro puesto: la hoja sale clara. → Task 2.

## Archivos

| Archivo | Qué hace |
| --- | --- |
| `src/theme.js` (nuevo) | Resuelve el tema, pone el atributo, caché y onda. |
| `src/theme.css` (nuevo) | Tokens claros y oscuros, regla base, onda, impresión. |
| `src/theme-coto.css` (nuevo) | Pintura oscura de las partes de Coto y el logo. |
| `src/badge-entry.js` | Llama a `installTheme` antes que a todo lo demás. |
| `src/popup.js`, `src/popup.css` | Fila "Tema" con tres botones; línea de ayuda. |
| `src/badge.css`, `src/skin.css`, `src/skin-list.css`, `src/skin-pdp.css`, `src/nutrition-ui.js` | Colores a tokens. |
| `manifest.json` | Suma los dos CSS nuevos. |
| `scripts/capture-chrome.mjs` (nuevo) | Captura encabezado, pie, inicio y la página de ingreso (adonde redirige `/carrito` sin sesión), sin sesión. |
| `scripts/theme-check.mjs` (nuevo) | Busca bloques claros en modo oscuro en el sitio real. |
| `tests/theme.test.js`, `tests/theme-contrast.test.js`, `tests/theme-tokens.test.js`, `tests/theme-css-dom.test.js` (nuevos) | Pruebas. |

Orden de los CSS en `manifest.json`: `src/theme.css`, `src/badge.css`, `src/skin.css`, `src/skin-list.css`, `src/skin-pdp.css`, `src/theme-coto.css`.

---

### Task 1: Interruptor del tema (`src/theme.js`)

**Files:**
- Create: `src/theme.js`
- Modify: `src/badge-entry.js`
- Test: `tests/theme.test.js`

**Interfaces:**
- Produces:
  - `export const THEME_ATTR = "data-gondola-theme"`
  - `export const THEME_CACHE_KEY = "gondola-theme"`
  - `export const WAVE_CLASS = "gondola-theme-wave"`
  - `export function resolveTheme(setting, systemDark)` → `"dark" | "light"`
  - `export function installTheme(win, doc, storage)` → `undefined`. `storage` tiene la forma de `chrome.storage.local`: `{ get(keys), onChanged: { addListener(fn) } }`.

- [ ] **Step 1: Escribir las pruebas que fallan**

En `tests/theme.test.js` (`// @vitest-environment jsdom`). Armar un `setup(stored, { systemDark, cache, reducedMotion, hidden, viewTransitions, brokenLocalStorage })` con el mismo estilo que `setup` de `tests/skin.test.js`: un `JSDOM` nuevo, un `storage` de mentira con `change(c)`, y sobre `win`:
- `matchMedia(q)`: devuelve `{ matches, addEventListener }` según la consulta (`prefers-color-scheme: dark` o `prefers-reduced-motion: reduce`); guardar el listener para poder disparar el cambio del sistema.
- `doc.startViewTransition`: si `viewTransitions`, un `vi.fn((cb) => { cb(); return { finished: Promise.resolve() }; })`; si no, no existe.
- `doc.hidden`: con `Object.defineProperty`.

Casos y afirmaciones (`attr = doc.documentElement.getAttribute("data-gondola-theme")`):

```js
describe("resolveTheme", () => {
  it.each([
    ["dark", false, "dark"], ["dark", true, "dark"],
    ["light", true, "light"], ["auto", true, "dark"], ["auto", false, "light"],
    [undefined, true, "light"], [true, true, "light"], ["DARK", true, "light"], [null, true, "light"],
  ])("%s con sistema oscuro=%s → %s", (setting, systemDark, out) => {
    expect(resolveTheme(setting, systemDark)).toBe(out);
  });
});
```

`installTheme`:
- `theme: "dark"` → tras `tick()`, `attr === "dark"` y `localStorage["gondola-theme"] === "dark"`.
- Sin ajuste → `attr === null` y la caché queda en `"light"`.
- Caché `"dark"`: justo después de llamar a `installTheme`, sin esperar, `attr === "dark"`.
- Caché `"dark"` y ajuste `"light"` → tras `tick()`, `attr === null` y `startViewTransition` no se llamó.
- Carga inicial con `theme: "dark"` y `viewTransitions` → `startViewTransition` no se llamó.
- Cambio con la página abierta (`storage.get` pasa a devolver `{ theme: "dark" }` y `change({ theme: { newValue: "dark" } })`) → `startViewTransition` se llamó 1 vez, `attr === "dark"`, y al terminar `documentElement.classList.contains("gondola-theme-wave") === false`.
- El mismo cambio con `reducedMotion`, o con `hidden`, o sin `viewTransitions` → `attr === "dark"` y `startViewTransition` no se llamó (cuando existe).
- `theme: "auto"` y el sistema pasa a oscuro (disparar el listener de `matchMedia`) → `attr === "dark"`. Con `theme: "light"`, el mismo disparo deja `attr === null`.
- `change({ skin: { newValue: false } })` no llama a `storage.get` otra vez.
- Dos cambios seguidos (`dark` y enseguida `light`) con una `startViewTransition` cuyo `finished` tarda → al final `attr === null` y la clase `gondola-theme-wave` no está.
- `brokenLocalStorage` (`getItem` y `setItem` tiran error) → `installTheme` no tira error y `attr === "dark"` con `theme: "dark"`.
- `storage.get` rechaza → `attr === null`, sin error.

- [ ] **Step 2: Correr y ver que fallan**

Run: `npx vitest run tests/theme.test.js`
Expected: FAIL, no existe `../src/theme.js`.

- [ ] **Step 3: Implementar `src/theme.js`**

Decisiones:
- Al instalar: leer la caché de forma síncrona y aplicar el atributo; después `storage.get(["theme"])` y aplicar sin onda.
- `apply(next, animate)`: si el atributo ya vale `next`, no hace nada. Con `animate` y permitido: pone `WAVE_CLASS`, llama `doc.startViewTransition(() => setAttr(next))` y saca la clase en `finished.finally(...)`. Si no: `setAttr(next)` directo.
- Para dos cambios seguidos: la clase se saca solo si la transición que termina es la última que se lanzó (guardar la referencia). `finished` puede rechazar: atrapar el error.
- Onda permitida solo si: no es la carga inicial, existe `doc.startViewTransition`, `matchMedia("(prefers-reduced-motion: reduce)").matches` es falso y `doc.hidden` es falso.
- Escribir la caché en cada `apply`. Todo acceso a `localStorage` va en `try/catch`.
- Comentario de cabecera en español, como `src/skin.js`.

- [ ] **Step 4: Conectar en `src/badge-entry.js`**

`import { installTheme } from "./theme.js";` y `installTheme(window, document, chrome.storage.local);` como primera llamada del archivo, antes de `createCompareClient`: tiene que correr antes de que la página se dibuje.

- [ ] **Step 5: Correr las pruebas**

Run: `npx vitest run tests/theme.test.js && npm run build`
Expected: PASS; el build termina sin errores.

- [ ] **Step 6: Commit**

```bash
git add src/theme.js src/badge-entry.js tests/theme.test.js
git commit -m "feat: interruptor del tema con caché, modo automático y onda"
```

---

### Task 2: Tokens, regla base y onda (`src/theme.css`)

**Files:**
- Create: `src/theme.css`, `tests/theme-contrast.test.js`
- Modify: `src/skin.css` (sacar el bloque de tokens de `[data-gondola-skin]`), `manifest.json`, `tests/package.test.js`

**Interfaces:**
- Consumes: `data-gondola-theme="dark"` y `gondola-theme-wave` de Task 1.
- Produces: tokens `--g-*` en `:root` (todos los de la tabla del spec, más `--g-navy-fill` y `--g-out`), con sus valores oscuros bajo `[data-gondola-theme="dark"]`. Las tasks 4 y 5 los usan.

- [ ] **Step 1: Escribir la prueba de contraste que falla**

`tests/theme-contrast.test.js`: lee `src/theme.css`, saca los tokens del bloque `:root` y del bloque `[data-gondola-theme="dark"]` (expresión regular sobre `--g-nombre: #hex;`) y calcula el contraste WCAG (luminancia relativa) de cada par, en los dos temas.

```js
const PARES = [ // [texto, fondo, mínimo]
  ["ink", "bg", 4.5], ["ink", "surface", 4.5], ["ink", "surface-2", 4.5], ["ink", "soft", 4.5],
  ["ink2", "bg", 4.5], ["ink2", "surface", 4.5], ["ink2", "soft", 4.5],
  ["red-text", "bg", 4.5], ["red-text", "surface", 4.5],
  ["#ffffff", "red", 4.5], ["#ffffff", "red-d", 4.5], ["#ffffff", "navy-fill", 4.5],
  ["navy", "navy-soft", 4.5], ["navy", "surface", 4.5],
  ["amber-ink", "amber-soft", 4.5], ["green", "green-soft", 4.5], ["green", "surface", 4.5],
  ["line", "bg", 1.2], // el borde se distingue del fondo
];
```

Además: en oscuro, `#16181d` sobre `plate` ≥ 4,5; ningún token oscuro vale `#000000` ni `#ffffff`; los dos bloques definen exactamente los mismos nombres (salvo `--g-out`, que solo está en `:root`).

- [ ] **Step 2: Correr y ver que falla**

Run: `npx vitest run tests/theme-contrast.test.js`
Expected: FAIL, no existe `src/theme.css`.

- [ ] **Step 3: Escribir `src/theme.css`**

Contenido, en este orden:
1. `:root { … }` con los valores claros de la tabla del spec, `--g-navy-fill: #14284b` y `--g-out`.
2. `[data-gondola-theme="dark"] { … }` con los valores oscuros, `--g-navy-fill: #2a4a86` y `color-scheme: dark`.
3. Regla base: `html[data-gondola-theme="dark"]` y su `body` con `background-color: var(--g-bg) !important; color: var(--g-ink);`.
4. Onda:

```css
html.gondola-theme-wave::view-transition-old(root) { animation: none; }
html.gondola-theme-wave::view-transition-new(root) {
  animation: gondola-theme-wave 650ms cubic-bezier(0.23, 1, 0.32, 1) both;
}
@keyframes gondola-theme-wave {
  from { clip-path: circle(0% at 100% 0%); }
  to { clip-path: circle(150% at 100% 0%); }
}
```

5. Impresión: dentro de `@media print`, `[data-gondola-theme="dark"]` vuelve a poner todos los tokens con sus valores claros y `color-scheme: light`, y la regla base usa fondo blanco.

Si un par de la prueba no llega al mínimo, ajustar el valor del token y corregir la tabla del spec en el mismo commit.

- [ ] **Step 4: Sacar los tokens de `src/skin.css`**

Borrar el bloque `[data-gondola-skin] { --g-…; }` (líneas 9 a 25). Ajustar el comentario de cabecera: los tokens ahora viven en `src/theme.css`.

- [ ] **Step 5: Sumar los CSS al manifest y a la prueba del paquete**

`manifest.json`: la lista `css` queda en el orden de la sección Archivos. `src/theme-coto.css` se suma ya, como archivo con un solo comentario de cabecera, para no tocar el manifest dos veces. En `tests/package.test.js`, sumar `src/theme.css` y `src/theme-coto.css` a las listas de archivos esperados (líneas 12 y 33).

Sumar a `tests/theme-contrast.test.js` la prueba de impresión: el bloque `@media print` redefine cada token que redefine el bloque oscuro.

- [ ] **Step 6: Correr todo**

Run: `npm test`
Expected: PASS en todas, incluidas `skin-css*.test.js` y `package.test.js`.

- [ ] **Step 7: Commit**

```bash
git add src/theme.css src/theme-coto.css src/skin.css manifest.json tests/theme-contrast.test.js tests/package.test.js docs/superpowers/specs/2026-11-11-modo-oscuro-design.md
git commit -m "feat: paleta clara y oscura en tokens, regla base y onda del tema"
```

---

### Task 3: Selector "Tema" en el popup

**Files:**
- Modify: `src/popup.js` (`SETTINGS`/`settingsView` líneas 17-36 y 215-267, `HELP`, `renderPopup` línea 311), `src/popup.css`
- Test: `tests/theme.test.js` (bloque nuevo `describe("popup: tema")`)

**Interfaces:**
- Consumes: clave `theme` de Global Constraints.
- Produces: `function themeRow(doc, value, storage)` → `HTMLFieldSetElement` (interna de `src/popup.js`).

- [ ] **Step 1: Escribir las pruebas que fallan**

Usar `renderPopup(document, storage, { version: "1", section: "apariencia" })` con un storage de mentira como el de `tests/bridge.test.js` (`fakeStorage`).

- Sin `theme` guardado: hay tres `input[type="radio"][name="theme"]` con valores `light`, `dark`, `auto`, en ese orden, y el marcado es `light`.
- Con `{ theme: "auto" }`: el marcado es `auto`. Con `{ theme: "x" }`: el marcado es `light`.
- Al marcar `dark` y disparar `change`: `storage.set` se llamó con `{ theme: "dark" }`.
- Los textos visibles de las tres opciones son `Claro`, `Oscuro`, `Automático`; el `legend` dice `Tema`.
- El grupo está dentro de la pantalla `[data-section="apariencia"]` y antes de la fila "Diseño Góndola".
- El estado de la fila del menú Apariencia sigue diciendo `2 de 2` (los radios no cuentan como interruptores).

- [ ] **Step 2: Correr y ver que fallan**

Run: `npx vitest run tests/theme.test.js -t "popup: tema"`
Expected: FAIL, no hay radios `name="theme"`.

- [ ] **Step 3: Implementar**

- `themeRow`: un `<fieldset class="setting theme">` con `<legend class="setting-title">Tema</legend>`, una descripción `<span class="setting-desc">` con el texto `Modo oscuro para todo el sitio de Coto. Automático sigue el tema de tu sistema.` y un `<div class="segmented">` con tres `<label>` (radio + texto). Guarda con `storage.set({ theme })` al cambiar. El valor inicial pasa por la misma regla que `resolveTheme` usa para validar: valor no válido → `light`.
- `settingsView`: en la sección `apariencia`, `themeRow` va primero en `body`.
- `renderPopup`: sumar `"theme"` a la lista de claves de `storage.get`.
- `HELP`: una entrada `["Modo oscuro", "En Ajustes, sección Apariencia, elegí Claro, Oscuro o Automático. Cambia todo el sitio de Coto. La ventana de Góndola sigue clara."]`.
- `src/popup.css`: `.segmented` como control de tres segmentos con los colores que el popup ya usa; el radio queda oculto a la vista pero con foco visible (`:focus-visible` en el segmento) y el segmento marcado se distingue por fondo y peso de letra, no solo por color. Área de toque mínima de 36 px de alto.

- [ ] **Step 4: Correr las pruebas**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/popup.js src/popup.css tests/theme.test.js
git commit -m "feat: selector de tema Claro, Oscuro y Automático en Ajustes"
```

---

### Task 4: Colores de Góndola a tokens

**Files:**
- Modify: `src/badge.css`, `src/skin.css`, `src/skin-list.css`, `src/skin-pdp.css`, `src/nutrition-ui.js`, `src/theme.css`
- Create: `tests/theme-tokens.test.js`
- Modify: `tests/theme-contrast.test.js`

**Interfaces:**
- Consumes: tokens de Task 2.
- Produces: tokens nuevos en `src/theme.css` (abajo). Ningún color escrito a mano en los CSS de Góndola, salvo excepciones marcadas.

Hoy hay unos 170 colores a mano (48 distintos en `src/badge.css`). Se agrupan por familia. Tokens nuevos, en `:root` y en el bloque oscuro (y en `@media print`):

| Token | Claro | Oscuro | Reemplaza a |
| --- | --- | --- | --- |
| `--g-ink3` | `#8a9096` | `#7d8594` | grises apagados de adorno o texto grande |
| `--g-line-2` | `#c3c8d2` | `#3a4250` | bordes fuertes (`#cfd4dc`, `#c3c8d2`, `#b9bec8`) |
| `--g-blue` | `#0c447c` | `#8fb0f0` | el azul de `src/badge.css` (`#0c447c`) |
| `--g-blue-soft` | el fondo claro que hoy acompaña a `#0c447c` | `#1a2540` | ese fondo |
| `--g-danger` | `#a32d2d` | `#ff8a80` | `#b01f17`, `#a32d2d` |
| `--g-danger-soft` | `#fff4f4` | `#3a1519` | `#fff4f4`, `#fff3f5` |

Mapa del resto:

| Literal de hoy | Token |
| --- | --- |
| `#fff` como fondo | `--g-surface` |
| `#fff` como texto sobre un relleno de color | queda fijo, con la marca de excepción |
| `#212529`, `#444`, `#16181d` | `--g-ink` |
| `#6b7177`, `#51585e`, `#5f5e5a`, `#5b616e` | `--g-ink2` |
| `#e3e6e8`, `#eceef0`, `#e6e8ec` | `--g-line` |
| `#f6f6f7`, `#f5f6f8` | `--g-soft` |
| `#e20025` como relleno / como texto | `--g-red` / `--g-red-text` |
| `#14284b` como texto o borde / como relleno | `--g-navy` / `--g-navy-fill` |
| `#ffc107`, `#ffc233` | `--g-amber` |
| `#fff4dc`, `#fff3cd`, `#faeeda`, `#fff4d1` | `--g-amber-soft` |
| `#633806`, `#7a4d00`, `#6b4a00` | `--g-amber-ink` |
| `#27500a`, `#1d7a35`, `#0a7a3d` | `--g-green` |

Regla para un literal que no está en las tablas: va al token de su familia (mismo tono y mismo papel). Si ninguna familia sirve, se crea un token `--g-*` con el literal como valor claro; el valor oscuro mantiene el tono, con luminosidad cerca de 15 % si es fondo y cerca de 75 % si es texto; y su par texto/fondo se suma a `PARES`.

Unificar grises casi iguales cambia muy poco el modo claro. Es aceptado (ver el spec).

- [ ] **Step 1: Escribir la prueba que falla**

`tests/theme-tokens.test.js`: para cada uno de los cuatro CSS, quitar los comentarios y buscar `#hex`, `rgb(`, `rgba(`, `hsl(`. Falla si queda alguno, salvo:
- la declaración termina con el comentario `/* fijo: <motivo> */` en la misma línea;
- es un `rgba(0, 0, 0, …)` dentro de `box-shadow`.

Además: toda `var(--g-…)` usada en esos CSS y en `src/theme-coto.css` está definida en `:root` de `src/theme.css`.

Para `src/nutrition-ui.js`: no queda ningún `#hex` en el archivo.

- [ ] **Step 2: Correr y ver que falla**

Run: `npx vitest run tests/theme-tokens.test.js`
Expected: FAIL, con la lista de literales por archivo.

- [ ] **Step 3: Sumar los tokens nuevos a `src/theme.css` y sus pares a `tests/theme-contrast.test.js`**

Pares nuevos: `["blue", "blue-soft", 4.5]`, `["blue", "surface", 4.5]`, `["danger", "danger-soft", 4.5]`, `["danger", "surface", 4.5]`, `["ink3", "surface", 3]`, `["line-2", "surface", 1.5]`.

- [ ] **Step 4: Reemplazar los literales, un archivo por vez**

Orden: `src/skin.css`, `src/skin-list.css`, `src/skin-pdp.css`, `src/badge.css`, `src/nutrition-ui.js` (sus dos colores pasan a clases o a `var(--g-…)`). Después de cada archivo: `npm test`.

En oscuro, las piezas que flotan (globos, avisos, resumen del carrito, menús propios) suman `border: 1px solid var(--g-line)` bajo `[data-gondola-theme="dark"]`: la sombra negra no se ve sobre fondo oscuro.

- [ ] **Step 5: Correr todo**

Run: `npm test && npm run build`
Expected: PASS.

- [ ] **Step 6: Revisar el modo claro en el sitio real**

Run: `npm run skin:check` (abre Chrome visible; no tocar la ventana).
Expected: las mismas medidas que antes del cambio, sin fallas. Con `SHOTS=<carpeta del scratchpad>`, mirar las capturas: la lista y la página de producto se ven como antes.

- [ ] **Step 7: Commit**

```bash
git add src tests docs/superpowers/specs/2026-11-11-modo-oscuro-design.md
git commit -m "refactor: los colores de Góndola usan tokens y cambian con el tema"
```

---

### Task 5: Capturas del resto del sitio

**Files:**
- Create: `scripts/capture-chrome.mjs`, `tests/fixtures/dom/header.html`, `footer.html`, `home.html`, `ingresar.html`
- Modify: `package.json` (script `fixtures:chrome`)

**Interfaces:**
- Produces: cuatro capturas en `tests/fixtures/dom/` que Task 6 usa para escribir y probar selectores.

- [ ] **Step 1: Escribir `scripts/capture-chrome.mjs`**

Mismo método y mismas advertencias de cabecera que `scripts/capture-dom.mjs` (Chrome visible, `CHROME_PATH`, limpieza de `img`/`source`). Diferencias:
- Siempre sin sesión y con un contexto nuevo de Playwright, sin cookies: así el encabezado no trae nombre ni dirección. Si en `app-header` aparece el texto "Hola" seguido de un nombre o un domicilio, el script falla y no escribe nada.
- Abre el inicio (`https://www.coto.com.ar/`) y `/carrito`.
- Guarda: `header.html` (`app-header` entero, con el menú de categorías abierto si se abre con un clic), `footer.html` (`footer-section`), `home.html` (el `body` sin encabezado ni pie, hasta 8 tarjetas por carrusel) y `ingresar.html` (el `body` de la página de ingreso, sin encabezado ni pie: sin sesión, `/carrito` redirige ahí).
- `DROP` igual al de `capture-dom.mjs`, sin `app-header` ni `footer-section`.
- Conserva el `<img>` del logo de Coto con su `src`, `class` y `alt`: Task 6 lo necesita.

- [ ] **Step 2: Correr la captura**

Run: `npm run fixtures:chrome`
Expected: los cuatro archivos existen, cada uno con más de 1 KB, y `grep -i -E "hola,|mi domicilio" tests/fixtures/dom/header.html` no encuentra datos de una persona.

- [ ] **Step 3: Commit**

```bash
git add scripts/capture-chrome.mjs package.json tests/fixtures/dom
git commit -m "test: capturas del encabezado, pie, inicio y carrito de Coto"
```

---

### Task 6: Pintura oscura de Coto y logo (`src/theme-coto.css`)

**Files:**
- Modify: `src/theme-coto.css`
- Create: `tests/theme-css-dom.test.js`, `scripts/theme-check.mjs`
- Modify: `package.json` (script `theme:check`)

**Interfaces:**
- Consumes: tokens de las tasks 2 y 4; capturas de Task 5 y las que ya existen (`lista.html`, `pdp.html`).
- Produces: `npm run theme:check`.

- [ ] **Step 1: Escribir la prueba de selectores que falla**

`tests/theme-css-dom.test.js`, con el método de `tests/skin-css-dom.test.js` (reusar `splitSelectors`; si hace falta, moverlo a `tests/helpers/css.js` e importarlo en los dos): cada selector de `src/theme-coto.css`, sin el prefijo `[data-gondola-theme="dark"]`, encuentra al menos un nodo en alguna de las seis capturas. `SKIP` para nodos que solo existen con sesión o al abrirse (mini carrito, ventanas): cada regla de ese tipo lleva encima el comentario `/* sin captura: <motivo> */` y la prueba cuenta que no haya más de 15.

Otra prueba: toda regla del archivo empieza con `[data-gondola-theme="dark"]`, y el archivo no tiene colores a mano (misma regla que `tests/theme-tokens.test.js`; sumar el archivo a esa prueba).

- [ ] **Step 2: Escribir `scripts/theme-check.mjs`**

Con Playwright y Chrome visible, como `scripts/skin-check.mjs`. Carga la extensión construida, guarda `theme: "dark"` en el storage y abre: inicio, una lista (la `LIST_URL` de `capture-dom.mjs`), una página de producto (`PDP_URL`) y `/carrito`. En cada una, después de bajar hasta el final:
- Lista los elementos visibles de más de 2.000 px² cuyo fondo calculado tiene luminancia mayor a 0,6. No cuentan: `img`, `picture`, `video`, `canvas`, `iframe`, lo que usa `--g-plate`, y lo que está dentro de un banner de publicidad.
- Lista los textos visibles con contraste menor a 4,5:1 contra su fondo efectivo (subir por los padres hasta un fondo opaco).
- Imprime selector corto, tamaño y color de cada hallazgo. Sale con código 1 si hay alguno.
- `SHOTS=<carpeta>` guarda una captura por página, arriba y al final. `URL=<dirección>` revisa una sola página.
- Comprueba el logo: en el `<img>` del logo, dibujado en un canvas con el filtro aplicado, ningún píxel opaco tiene tono rojo (R > 150 con G y B < 90).

- [ ] **Step 3: Pintar por zona**

Una zona por commit, en este orden: encabezado, buscador y logo; menú de categorías; lista; página de producto; inicio; `/carrito` y mini carrito; pie; menús desplegables y ventanas.

Reglas para todas las zonas:
- Fondo de página `--g-bg`; tarjetas y barras `--g-surface`; menús y ventanas `--g-surface-2`; bordes `--g-line`; texto `--g-ink` y `--g-ink2`.
- Sombras de Coto: `box-shadow: none !important` y borde `--g-line`.
- Fotos de producto: `background: var(--g-plate)`, `border-radius: 8px` y un relleno interno chico, sobre el contenedor de la foto. La foto no lleva filtro.
- Botones rojos de Coto: relleno `--g-red`, texto blanco. Rojo como texto: `--g-red-text`.
- Campos de texto: fondo `--g-bg`, borde `--g-line-2`, texto `--g-ink`, texto de ayuda `--g-ink2`.
- Íconos e imágenes oscuras con fondo transparente (medios de pago, sellos del pie) que no se leen sobre oscuro: van sobre `--g-plate`, igual que las fotos.
- Selectores: clases con nombre propio de Coto y etiquetas de sus componentes. Nada de `_ngcontent-*` ni clases de utilidad sueltas (norma de `src/skin-dom.js`).
- Logo: sobre el `<img>` del logo en el encabezado, `filter: grayscale(1) contrast(4) !important` y `outline: 1px solid var(--g-line)` con el radio de la placa. Si el logo es un `background-image` o un `<svg>` en línea, el mismo filtro va sobre ese nodo.

Después de cada zona:

Run: `npm test && npm run build && URL=<una página con esa zona> SHOTS=<carpeta del scratchpad> npm run theme:check`
Expected: pruebas en verde; `theme:check` sin hallazgos en esa zona; la captura se ve bien.

```bash
git add src/theme-coto.css tests
git commit -m "feat: modo oscuro en <zona>"
```

- [ ] **Step 4: Pasada completa**

Run: `npm run theme:check`
Expected: código 0 en las cuatro páginas, sin bloques claros ni textos con poco contraste, y el logo sin rojo.

Run: `npm run skin:check`
Expected: sin fallas (el modo claro y la piel siguen igual).

- [ ] **Step 5: Commit de las herramientas**

```bash
git add scripts/theme-check.mjs package.json tests/theme-css-dom.test.js
git commit -m "test: revisión automática del modo oscuro en el sitio real"
```

(Si las herramientas ya entraron con la primera zona, este paso no hace falta.)

---

### Task 7: Revisión con sesión, textos y versión 0.15.0

**Files:**
- Modify: `PRODUCT.md`, `README.md`, `README.en.md`, `docs/chrome-web-store.md`, `manifest.json`, `package.json`, `package-lock.json`

- [ ] **Step 1: Revisión a ojo con el dueño del repo**

Lo que no tiene captura necesita una sesión real: mini carrito con productos, `/carrito` con productos, selector de cantidad, menú de perfil con "Configurar Góndola", avisos de promo. Pedirle al dueño que cargue la extensión desde `D:\Trabajo\Personal\Otros\coto-precio-por-unidad` (la carpeta principal, no el worktree; primero hay que llevar la rama ahí o construir ahí) y que revise en oscuro esas piezas y la onda en los dos sentidos. Anotar cada problema y corregirlo en `src/theme-coto.css` con su comentario `/* sin captura: … */`.

- [ ] **Step 2: Textos**

- `PRODUCT.md`, "Capabilities and Constraints": sumar que con el tema oscuro pone `data-gondola-theme` en `<html>` y, durante el cambio, la clase `gondola-theme-wave`. En "Operating Context": el popup también elige el tema.
- `README.md` y `README.en.md`: una línea en la lista de funciones, con el estilo de las que ya están.
- `docs/chrome-web-store.md`: una línea en la descripción.

- [ ] **Step 3: Versión**

`0.14.1` → `0.15.0` en `manifest.json`, `package.json` y `package-lock.json` (las dos apariciones).

- [ ] **Step 4: Verificación final**

Run: `npm test && npm run package`
Expected: todas las pruebas en verde y el paquete se arma con los dos CSS nuevos adentro.

- [ ] **Step 5: Commit**

```bash
git add PRODUCT.md README.md README.en.md docs/chrome-web-store.md manifest.json package.json package-lock.json src/theme-coto.css
git commit -m "feat: modo oscuro para todo el sitio de Coto (0.15.0)"
```
