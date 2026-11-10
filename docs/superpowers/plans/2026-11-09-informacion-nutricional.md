# Información nutricional en la PDP: plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** En la página de producto de coto.com.ar, mostrar la tabla nutricional de Open Food Facts (por EAN), o una línea que invita a cargarla.

**Architecture:** Funciones puras en `src/nutrition.js` convierten la respuesta de Open Food Facts. El service worker (`src/nutrition-service.js`) consulta y guarda 7 días en `chrome.storage.local`, igual que el comparador. `src/nutrition-ui.js` dibuja el bloque y `src/badge.js` lo llama desde `renderPdp`, porque ahí viven las etiquetas del producto.

**Tech Stack:** JavaScript ES modules, Chrome Manifest V3, esbuild (`npm run build`), Vitest + jsdom (`npm test`).

**Spec:** `docs/superpowers/specs/2026-11-09-informacion-nutricional-design.md`

## Global Constraints

- Fuente única: `https://world.openfoodfacts.org/api/v2/product/{ean}?fields=product_name,nutriments,serving_size`.
- Pedidos con `credentials: "omit"` y `AbortSignal.timeout(8000)`.
- Memoria: clave de storage `nutriCache`, 7 días (`604_800_000` ms), máximo 2000 productos. `"error"` no se guarda.
- Categorías raíz de comida: `catv00001254` (Almacén), `catv00001255` (Frescos), `catv00001256` (Bebidas), `catv00001296` (Congelados).
- Pesable: `Number(product_weighable) === 1` o `product_unit_of_measure === "KGS"`.
- Ajuste: clave `nutrition`, prendido salvo `false`. Texto del popup: título "Información nutricional", texto "En la página de un producto, la tabla nutricional de Open Food Facts, si existe."
- Clases CSS con prefijo `coto-unit-nutri`; estilos en `src/badge.css`.
- Textos fijos (copiar tal cual):
  - Resumen: `Información nutricional · {kcal} kcal cada 100 g` (o `cada 100 ml`); sin kcal: `Información nutricional`.
  - Pie: `Fuente: Open Food Facts, datos cargados por la comunidad.` + link `Ver ficha`.
  - Sin datos: `Sin información nutricional. Podés cargarla en Open Food Facts` (el link va sobre "Podés cargarla en Open Food Facts").
- Links externos con `target="_blank"` y `rel="noopener noreferrer"`.
- Comentarios y textos en español, como el resto del código.

**Cambio respecto del spec:** el spec nombra `installNutritionUi(win, doc, { request })`. Como las etiquetas viven en `badge.js`, la interfaz pasa a ser `createNutritionUi(doc, { request, onUpdate })` y `badge.js` la llama desde `renderPdp`. Task 6 actualiza el spec.

## Review Focus

1. **Navegar entre dos PDP sin recargar (SPA):** al pasar del producto A al B, no puede quedar la tabla de A. Test en Task 5.
2. **Respuesta que llega tarde:** si llega la tabla de A cuando ya se ve B, o con el ajuste apagado, no se dibuja. Test en Task 5.
3. **`sendMessage` que rechaza** (service worker reiniciando o extensión recargada): se trata como `"error"`, sin excepción en la página. Test en Task 6.
4. **Valores como texto** (`"3.5"`) se aceptan; `"abc"`, `null` o `NaN` se descartan. Test en Task 2.
5. **Porción sin `serving_size`** pero con valores `_serving`: la columna dice `Por porción` sin paréntesis. Test en Task 5.

---

### Task 1: Memoria con clave configurable

**Files:**
- Modify: `src/price-cache.js`
- Test: `tests/price-cache.test.js`

**Interfaces:**
- Produces: `createPriceCache(storage, now = Date.now, { key = "cmpCache", ttlMs = 21_600_000, max = 3000 } = {})` → `{ get(keys: string[]): Promise<object>, set(entries: object): Promise<void> }`. Sin `key`, se comporta igual que hoy.

- [ ] **Step 1: Write the failing test** en `tests/price-cache.test.js`

```js
it("con otra clave no toca la memoria del comparador", async () => {
  const storage = fakeStorage({ cmpCache: { "dia:1": { at: 1000, v: offer } } });
  const nutri = createPriceCache(storage, () => 1000, { key: "nutriCache", ttlMs: 604_800_000, max: 2000 });
  await nutri.set({ "7790895000997": "missing" });
  expect(storage.data.cmpCache).toEqual({ "dia:1": { at: 1000, v: offer } });
  expect(storage.data.nutriCache["7790895000997"]).toEqual({ at: 1000, v: "missing" });
  expect(await nutri.get(["7790895000997", "dia:1"])).toEqual({ "7790895000997": "missing" });
});
```

- [ ] **Step 2: Run** `npx vitest run tests/price-cache.test.js` — Expected: FAIL (`storage.data.nutriCache` es `undefined`).
- [ ] **Step 3: Implement** — reemplazar la constante `KEY` por la opción `key`. Actualizar el comentario de arriba: la memoria guarda bajo `key`.
- [ ] **Step 4: Run** `npx vitest run tests/price-cache.test.js` — Expected: PASS, incluidos los tests viejos.
- [ ] **Step 5: Commit**

```bash
git add src/price-cache.js tests/price-cache.test.js
git commit -m "refactor: price cache storage key as option"
```

---

### Task 2: Convertir la respuesta de Open Food Facts

**Files:**
- Create: `src/nutrition.js`
- Create: `scripts/capture-off-fixtures.mjs`
- Create: `tests/fixtures/off.js`
- Test: `tests/nutrition.test.js`
- Modify: `package.json` (script `"fixtures:off": "node scripts/capture-off-fixtures.mjs"`)

**Interfaces:**
- Produces:
  - `type Nutrients = { kcal?, carbs?, sugars?, proteins?, fat?, saturatedFat?, transFat?, fiber?, sodiumMg? }` (todos `number`).
  - `type Nutrition = { per100: Nutrients, perServing: Nutrients | null, servingSize: string | null, url: string }`.
  - `parseOff(json: object | null, ean: string) → Nutrition | "missing"`.
  - `isFood(groups: Array<{ group_id: string }> | undefined) → boolean`.
  - `nutriEligible(data: object) → boolean` = `isFood(data.groups)` y no pesable (regla de Global Constraints).
  - `offProductUrl(ean: string) → string` = `https://world.openfoodfacts.org/product/{ean}`.
  - `offApiUrl(ean: string) → string` = la URL de la API de Global Constraints.
  - `NUTRIENTS: Array<[key, offField, label, unit]>`, en este orden:
    `kcal/energy-kcal/Valor energético/kcal`, `carbs/carbohydrates/Carbohidratos/g`, `sugars/sugars/Azúcares/g`, `proteins/proteins/Proteínas/g`, `fat/fat/Grasas totales/g`, `saturatedFat/saturated-fat/Grasas saturadas/g`, `transFat/trans-fat/Grasas trans/g`, `fiber/fiber/Fibra/g`, `sodiumMg/sodium/Sodio/mg`.

- [ ] **Step 1: Capturar fixtures reales.** `scripts/capture-off-fixtures.mjs` pide `offApiUrl` para estos EAN y escribe `tests/fixtures/off.js` con `export const OFF = { [ean]: json }` y un comentario con la fecha:
  - `7790895000997`: Coca-Cola 2,25 L (tabla cada 100 ml).
  - `7790040613706`: galletitas con valores `_serving`.
  - `7790040143524`: Rumba, ficha sin tabla.
  - `7798078450393`: no existe (`status: 0`).

  Usar `User-Agent: Gondola/<version del manifest> (github.com/hysmarcos/gondola)`. Open Food Facts a veces tarda o responde 503: reintentar hasta 3 veces con 5 s de espera. Run: `npm run fixtures:off`. Expected: el archivo tiene las 4 claves. Si `7790040613706` ya no trae campos `_serving`, elegir otro EAN de galletitas que sí los traiga y anotarlo en el comentario del fixture.

- [ ] **Step 2: Write the failing tests** en `tests/nutrition.test.js`

```js
import { describe, it, expect } from "vitest";
import { parseOff, isFood, nutriEligible, offProductUrl } from "../src/nutrition.js";
import { OFF } from "./fixtures/off.js";

const off = (n100, extra = {}) => ({ status: 1, product: { nutriments: n100, ...extra } });

describe("parseOff", () => {
  it("Coca-Cola: tabla cada 100 y link a la ficha", () => {
    const n = parseOff(OFF["7790895000997"], "7790895000997");
    expect(n.per100.kcal).toBeGreaterThan(0);
    expect(n.url).toBe("https://world.openfoodfacts.org/product/7790895000997");
  });
  it("con valores por porción arma perServing", () => {
    const n = parseOff(OFF["7790040613706"], "7790040613706");
    expect(n.perServing).not.toBeNull();
    expect(Object.keys(n.perServing).length).toBeGreaterThan(0);
  });
  it("ficha sin tabla y producto inexistente dan missing", () => {
    expect(parseOff(OFF["7790040143524"], "7790040143524")).toBe("missing");
    expect(parseOff(OFF["7798078450393"], "7798078450393")).toBe("missing");
    expect(parseOff(null, "1")).toBe("missing");
  });
  it("sodio en g pasa a mg", () => {
    const n = parseOff(off({ "energy-kcal_100g": 50, fat_100g: 1, sodium_100g: 0.012 }), "1");
    expect(n.per100.sodiumMg).toBe(12);
  });
  it("menos de 3 nutrientes válidos da missing", () => {
    expect(parseOff(off({ "energy-kcal_100g": 50, fat_100g: 1 }), "1")).toBe("missing");
  });
  it("descarta negativos, más de 100 g, más de 900 kcal y texto no numérico; acepta '3.5'", () => {
    const n = parseOff(off({ "energy-kcal_100g": 950, fat_100g: -1, sugars_100g: 120, carbohydrates_100g: "3.5", proteins_100g: "abc", fiber_100g: 2, sodium_100g: 0.1 }), "1");
    expect(n.per100).toEqual({ carbs: 3.5, fiber: 2, sodiumMg: 100 });
  });
  it("sin valores _serving, perServing es null; servingSize tal como viene", () => {
    const n = parseOff(off({ "energy-kcal_100g": 50, fat_100g: 1, sugars_100g: 2 }, { serving_size: "30 g" }), "1");
    expect(n.perServing).toBeNull();
    expect(n.servingSize).toBe("30 g");
  });
});

describe("isFood / nutriEligible", () => {
  const g = (...ids) => ids.map((group_id) => ({ group_id }));
  it("comida y bebida sí; limpieza y perfumería no", () => {
    expect(isFood(g("catv00001254"))).toBe(true);
    expect(isFood(g("catv00001296", "catv00003146"))).toBe(true);
    expect(isFood(g("catv00001258"))).toBe(false);
    expect(isFood(g("catv00001257"))).toBe(false);
    expect(isFood(undefined)).toBe(false);
  });
  it("pesable no aplica aunque sea comida", () => {
    expect(nutriEligible({ groups: g("catv00001255"), product_weighable: 1 })).toBe(false);
    expect(nutriEligible({ groups: g("catv00001255"), product_unit_of_measure: "KGS" })).toBe(false);
    expect(nutriEligible({ groups: g("catv00001255"), product_weighable: 0 })).toBe(true);
  });
  it("offProductUrl", () => expect(offProductUrl("123")).toBe("https://world.openfoodfacts.org/product/123"));
});
```

- [ ] **Step 3: Run** `npx vitest run tests/nutrition.test.js` — Expected: FAIL (no existe `src/nutrition.js`).
- [ ] **Step 4: Implement `src/nutrition.js`** con las firmas de Interfaces. Reglas de valor válido: `Number(v)` finito, `>= 0`; si la unidad es `g`, `<= 100`; si es `kcal`, `<= 900`. El sodio se valida en gramos y después se multiplica por 1000 y se redondea a entero. `perServing` usa los mismos campos con sufijo `_serving` y las mismas reglas salvo los topes (una porción puede pasar 100 g); es `null` si no queda ningún valor. `status !== 1` o sin `product` da `"missing"`.
- [ ] **Step 5: Run** `npx vitest run tests/nutrition.test.js` — Expected: PASS.
- [ ] **Step 6: Commit**

```bash
git add src/nutrition.js scripts/capture-off-fixtures.mjs tests/fixtures/off.js tests/nutrition.test.js package.json
git commit -m "feat: parse Open Food Facts nutrition facts"
```

---

### Task 3: Servicio en el background

**Files:**
- Create: `src/nutrition-service.js`
- Modify: `src/background.js`
- Modify: `manifest.json` (agregar `"https://world.openfoodfacts.org/*"` a `host_permissions`)
- Test: `tests/nutrition-service.test.js`

**Interfaces:**
- Consumes: `parseOff`, `offApiUrl` (Task 2); `createPriceCache` con `key` (Task 1).
- Produces: `createNutritionService({ fetch, cache, timeoutMs = 8000 }) → { get(ean: string): Promise<Nutrition | "missing" | "error"> }`. Mensaje del background: `{ type: "nutrition", ean }` → responde con el resultado de `get`.

- [ ] **Step 1: Write the failing tests** en `tests/nutrition-service.test.js`. `fetch` falso que cuenta llamadas y devuelve `{ ok, status, json }`; memoria falsa con `get/set` en un objeto.

```js
it("usa la memoria si la tiene y no llama a fetch", async () => { /* cache.get devuelve { [ean]: "missing" } → get(ean) === "missing", fetch 0 veces */ });
it("sin memoria pide la URL de la API sin cookies y guarda el resultado", async () => {
  /* fetch devuelve OFF["7790895000997"] → resultado con per100; fetch llamado con offApiUrl(ean) y init.credentials === "omit"; cache.set recibió { [ean]: resultado } */
});
it("404 da missing y se guarda", async () => { /* status 404 → "missing"; cache.set({ [ean]: "missing" }) */ });
it("500, red caída o tiempo máximo dan error y no se guarda", async () => { /* status 500 → "error"; fetch que rechaza → "error"; cache.set nunca llamado */ });
it("dos pedidos del mismo EAN a la vez hacen un solo fetch", async () => { /* Promise.all([get(e), get(e)]) → fetch 1 vez, mismos resultados */ });
it("EAN inválido da missing sin pedir", async () => { /* get("abc") → "missing", fetch 0 veces; usar validEan de src/compare.js */ });
```

- [ ] **Step 2: Run** `npx vitest run tests/nutrition-service.test.js` — Expected: FAIL.
- [ ] **Step 3: Implement `src/nutrition-service.js`.** Mismo estilo que `compare-service.js`: `inflight` Map por EAN, `signal: AbortSignal.timeout(timeoutMs)`, un fallo de `cache.get/set` no rompe el resultado. Nunca rechaza.
- [ ] **Step 4: Run** `npx vitest run tests/nutrition-service.test.js` — Expected: PASS.
- [ ] **Step 5: Conectar en `src/background.js`.** Crear el servicio con `createPriceCache(chrome.storage.local, Date.now, { key: "nutriCache", ttlMs: 604_800_000, max: 2000 })`. El listener atiende `type === "compare"` como hoy y `type === "nutrition"` con `service.get(m.ean).then(reply, () => reply("error"))`; devuelve `true` en los dos. Actualizar el comentario de arriba del archivo. Sumar el permiso en `manifest.json`.
- [ ] **Step 6: Run** `npm test && npm run build` — Expected: todo PASS y build sin errores.
- [ ] **Step 7: Commit**

```bash
git add src/nutrition-service.js src/background.js manifest.json tests/nutrition-service.test.js
git commit -m "feat: nutrition service in background with 7-day cache"
```

---

### Task 4: Marcar en la etiqueta si aplica

**Files:**
- Modify: `src/sort.js` (las dos líneas que arman `label` con `compareFields`)
- Test: `tests/sort.test.js`

**Interfaces:**
- Consumes: `nutriEligible(data)` (Task 2).
- Produces: cada etiqueta de `sortResults` y `labelsFor` tiene `nutri: boolean`.

- [ ] **Step 1: Write the failing test** en `tests/sort.test.js`: `labelsFor` con un producto de `catv00001254` con EAN da `nutri: true`; uno de `catv00001258` da `nutri: false`; uno pesable de `catv00001255` da `nutri: false`. Mismo chequeo para una etiqueta de `sortResults`. Reusar los helpers de fixtures del archivo.
- [ ] **Step 2: Run** `npx vitest run tests/sort.test.js` — Expected: FAIL (`nutri` es `undefined`).
- [ ] **Step 3: Implement** — `const label = { ...u, ...compareFields(r.data, store, opts), nutri: nutriEligible(r.data) };` en los dos lugares.
- [ ] **Step 4: Run** `npm test` — Expected: PASS (los tests que comparan etiquetas enteras con `toEqual` pueden necesitar `nutri`; ajustarlos).
- [ ] **Step 5: Commit**

```bash
git add src/sort.js tests/sort.test.js
git commit -m "feat: labels say if a product can show nutrition facts"
```

---

### Task 5: Dibujar el bloque

**Files:**
- Create: `src/nutrition-ui.js`
- Modify: `src/badge.css`
- Test: `tests/nutrition-ui.test.js` (`// @vitest-environment jsdom`)

**Interfaces:**
- Consumes: `NUTRIENTS`, `offProductUrl`, tipo `Nutrition` (Task 2).
- Produces:
  - `renderNutrition(doc, result: Nutrition | "missing", { ean, liquid: boolean }) → HTMLElement`. Raíz con clase `coto-unit-nutri` y `data-ean`.
  - `createNutritionUi(doc, { request: (ean) => Promise<result>, onUpdate: () => void }) → { paint(container: Element, anchor: Element | null, label: object | undefined, enabled: boolean): void }`.
    - Si `!enabled`, sin `label`, `!label.nutri` o sin `label.ean`: borra el bloque del `container` y no pide.
    - Pide una sola vez por EAN (Map interno). Mientras espera, o si el resultado es `"error"`, no hay bloque.
    - Al llegar un resultado llama `onUpdate()`; el dibujo pasa en el próximo `paint`, que usa el `label` de ese momento.
    - Si el bloque existente tiene otro `data-ean`, lo reemplaza. Si ya está el mismo EAN, no lo toca (no cierra un `<details>` abierto).
    - El bloque va después de `anchor` (o al final de `container`).
    - `liquid` = `label.group === "L"`.

Formato: kcal y mg sin decimales; gramos con un decimal y coma decimal (`3,5 g`). Tabla con `<th>` "cada 100 g" (o "cada 100 ml") y, si hay `perServing`, "Por porción (30 g)" o "Por porción" sin `servingSize`. Una fila por nutriente presente en `per100` o `perServing`, en el orden de `NUTRIENTS`; celda vacía si falta en una columna.

- [ ] **Step 1: Write the failing tests** en `tests/nutrition-ui.test.js`

```js
const N = { per100: { kcal: 480, carbs: 70.25, sugars: 30, fat: 20, sodiumMg: 250 }, perServing: { kcal: 144 }, servingSize: "30 g", url: "https://world.openfoodfacts.org/product/1" };

it("resumen con kcal y tabla con columna por porción", () => {
  const el = renderNutrition(document, N, { ean: "1", liquid: false });
  expect(el.querySelector("summary").textContent).toBe("Información nutricional · 480 kcal cada 100 g");
  expect([...el.querySelectorAll("th")].map((t) => t.textContent)).toContain("Por porción (30 g)");
  expect(el.textContent).toContain("70,3 g");
  expect(el.textContent).toContain("250 mg");
  expect(el.querySelector("a").href).toBe("https://world.openfoodfacts.org/product/1");
  expect(el.textContent).toContain("Fuente: Open Food Facts, datos cargados por la comunidad.");
});
it("bebida dice cada 100 ml", () => { /* liquid: true → summary termina en "cada 100 ml" */ });
it("porción sin serving_size dice Por porción", () => { /* servingSize: null → th "Por porción" */ });
it("sin kcal el resumen es solo el título", () => { /* per100 sin kcal → "Información nutricional" */ });
it("missing: una línea con link para cargarla", () => {
  const el = renderNutrition(document, "missing", { ean: "779", liquid: false });
  expect(el.textContent).toBe("Sin información nutricional. Podés cargarla en Open Food Facts");
  expect(el.querySelector("a").href).toBe("https://world.openfoodfacts.org/product/779");
  expect(el.querySelector("a").rel).toBe("noopener noreferrer");
});

describe("createNutritionUi", () => {
  // request falso con promesas que el test resuelve a mano; onUpdate cuenta llamadas.
  it("pide una vez por EAN y dibuja después de onUpdate", async () => { /* paint dos veces → request 1 vez; resolver N; await; onUpdate 1 vez; paint → hay .coto-unit-nutri después de anchor */ });
  it("no pide si no es comida, sin EAN o con el ajuste apagado", () => { /* label.nutri false / ean null / enabled false → request 0 veces, sin bloque */ });
  it("apagar el ajuste borra el bloque", () => { /* con bloque dibujado, paint(..., false) → sin .coto-unit-nutri */ });
  it("error: no dibuja nada", async () => { /* request resuelve "error" → sin bloque */ });
  it("SPA: al pasar de A a B no queda la tabla de A", async () => { /* dibujar A; paint con label B (B pendiente) → sin bloque de A; resolver B → bloque con data-ean B */ });
  it("respuesta tardía de A con B en pantalla no dibuja A", async () => { /* paint A (pendiente); paint B; resolver A; paint B → no hay data-ean A */ });
  it("mismo EAN no reemplaza el bloque (details abierto sigue abierto)", async () => { /* dibujar; abrir details; paint de nuevo → mismo nodo, open true */ });
});
```

- [ ] **Step 2: Run** `npx vitest run tests/nutrition-ui.test.js` — Expected: FAIL.
- [ ] **Step 3: Implement `src/nutrition-ui.js`** con las firmas de Interfaces. Crear nodos con `createElement`/`textContent` (sin `innerHTML` con datos de afuera).
- [ ] **Step 4: Estilos en `src/badge.css`:** `.coto-unit-nutri` como bloque debajo de `.coto-unit-box--pdp` (mismo ancho máximo, 12–13 px, tabla con filas finas, números alineados a la derecha con `font-variant-numeric: tabular-nums`), `.coto-unit-nutri-missing` como una línea de 12 px en gris. Mismos colores que la caja de precio.
- [ ] **Step 5: Run** `npx vitest run tests/nutrition-ui.test.js` — Expected: PASS.
- [ ] **Step 6: Commit**

```bash
git add src/nutrition-ui.js src/badge.css tests/nutrition-ui.test.js
git commit -m "feat: nutrition facts block for the product page"
```

---

### Task 6: Conectar en la página y el popup

**Files:**
- Modify: `src/badge.js` (`installBadges`: `state.nutrition`, `renderPdp`, mensaje `settings`)
- Modify: `src/badge-entry.js`
- Modify: `src/bridge.js` (`KEYS` y mensaje `settings`)
- Modify: `src/popup.js` (`SETTINGS` y la lista de `storage.get`)
- Modify: `docs/superpowers/specs/2026-11-09-informacion-nutricional-design.md` (sección 3: `createNutritionUi` reemplaza a `installNutritionUi`, llamada desde `renderPdp`)
- Test: `tests/badge.test.js`, `tests/bridge.test.js`

**Interfaces:**
- Consumes: `createNutritionUi` (Task 5); mensaje `{ type: "nutrition", ean }` (Task 3); `label.nutri` (Task 4).
- Produces: `installBadges(win, doc, { …, nutrition })`, donde `nutrition` es el objeto de `createNutritionUi` (opcional: sin él, no hay bloque).

- [ ] **Step 1: Write the failing tests.**
  - `tests/bridge.test.js`: el mensaje `settings` trae `nutrition: true` por defecto y `false` si `storage` tiene `nutrition: false`; un cambio en `nutrition` reenvía `settings`.
  - `tests/badge.test.js`: con un `nutrition` falso (`paint` espía), en una PDP con etiqueta, `renderPdp` llama `paint(wrap, box, label, true)`; tras `settings` con `nutrition: false`, la llamada siguiente pasa `false`.
  - En `tests/badge.test.js` o un test chico de `badge-entry`: si `request` rechaza (como `chrome.runtime.sendMessage` con la extensión recargada), no hay excepción y no hay bloque. Para eso, `badge-entry.js` envuelve: `request: (ean) => chrome.runtime.sendMessage({ type: "nutrition", ean }).catch(() => "error")`.
- [ ] **Step 2: Run** `npx vitest run tests/badge.test.js tests/bridge.test.js` — Expected: FAIL.
- [ ] **Step 3: Implement.**
  - `bridge.js`: sumar `"nutrition"` a `KEYS` y `nutrition: s.nutrition !== false` al mensaje.
  - `badge.js`: `state.nutrition = m.nutrition !== false` en `settings`. En `renderPdp`, después de `paintBox`, `deps.nutrition?.paint(wrap ?? price.parentElement, box, label, state.nutrition)`.
  - `badge-entry.js`: `const nutrition = createNutritionUi(document, { request, onUpdate })`. `onUpdate` dispara el mismo repintado que usa `badge.js` (exponer `render` desde `installBadges` como valor devuelto, o pasar un callback; elegir uno y usarlo igual en el test).
  - `popup.js`: sumar el ajuste de Global Constraints al final de `SETTINGS` y `"nutrition"` a la lista de `storage.get`.
  - Spec: actualizar la sección 3.
- [ ] **Step 4: Run** `npm test && npm run build` — Expected: todo PASS, build sin errores.
- [ ] **Step 5: Commit**

```bash
git add src/badge.js src/badge-entry.js src/bridge.js src/popup.js tests/badge.test.js tests/bridge.test.js docs/superpowers/specs/2026-11-09-informacion-nutricional-design.md
git commit -m "feat: show nutrition facts on Coto product pages, with popup setting"
```

---

### Task 7: Privacidad, README y prueba real

**Files:**
- Modify: `site/privacidad.html`
- Modify: `README.md` (sección 5, "Qué agrega" y el badge de tests si cambió el número)
- Modify: `README.en.md` (mismas secciones)
- Modify: `src/popup.js` (`HELP`: entrada "Información nutricional")

- [ ] **Step 1: Textos.**
  - Privacidad: Open Food Facts como servicio externo. Se manda solo el código de barras del producto que abrís, sin cookies ni datos personales. Link a `https://world.openfoodfacts.org`.
  - README es/en: la función nueva en "Qué agrega"; en la sección 5, la misma aclaración de privacidad y el permiso `world.openfoodfacts.org`; atribución ODbL a Open Food Facts.
  - `HELP`: `["Información nutricional", "Tabla de Open Food Facts por código de barras, cargada por la comunidad. Si falta, podés cargarla vos."]`.
- [ ] **Step 2: Run** `npm test && npm run build` — Expected: PASS. Actualizar el número del badge de tests con el total que da Vitest.
- [ ] **Step 3: Prueba en coto.com.ar** con la extensión cargada sin empaquetar (`chrome://extensions`, carpeta del repo):
  - PDP de Coca-Cola 2,25 L: aparece "Información nutricional · … kcal cada 100 ml" y la tabla abre.
  - PDP de Galletitas Rumba 330 g (`7790040143524`): aparece la línea "Sin información nutricional…".
  - PDP de una lavandina: no aparece nada.
  - Apagar "Información nutricional" en el popup: el bloque se va sin recargar.
- [ ] **Step 4: Commit**

```bash
git add site/privacidad.html README.md README.en.md src/popup.js
git commit -m "docs: privacy policy and README mention Open Food Facts"
```
