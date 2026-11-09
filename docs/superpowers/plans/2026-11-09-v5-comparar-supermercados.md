# v5 Comparar con Carrefour, Día y Más — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** En cada producto de coto.com.ar, mostrar el precio del mismo producto (mismo EAN) en Carrefour, Día y Más, con ícono ▼ / = / ▲ respecto de Coto.

**Architecture:** El interceptor suma `ean` y `cmp` (precio Coto por unidad) a cada etiqueta. Los content scripts piden comparaciones por EAN a un service worker nuevo (`background.js`) a través de un cliente que agrupa pedidos. El service worker consulta las APIs VTEX públicas (búsqueda por EAN + carrito simulado con 1, 2 y 3 unidades), guarda resultados 6 h en `chrome.storage.local` y responde. La UI pinta filas dentro de la caja azul actual.

**Tech Stack:** JavaScript ES modules, esbuild (IIFE), vitest + jsdom, Chrome Manifest V3.

**Spec:** `docs/superpowers/specs/2026-11-09-v5-comparar-supermercados-design.md`

## Global Constraints

- Súper, en este orden: `carrefour` "Carrefour" `www.carrefour.com.ar` sc 1; `dia` "Día" `diaonline.supermercadosdia.com.ar` sc 1; `mas` "Más" `www.masonline.com.ar` sc 1.
- Mismo producto = mismo EAN. EAN válido: `/^\d{8,14}$/`. Sin EAN válido o pesable → sin comparación.
- Coto: precio con ofertas de Coto, sin banco (`finalPrice` + `takeQty`). Otros: carrito simulado con q = 1, 2, 3; gana el menor `total / q`.
- Ícono: `d = (otro − coto) / coto`; `d < −0.01` → `"lower"`; `|d| ≤ 0.01` → `"equal"`; `d > 0.01` → `"higher"`.
- Memoria: 6 h (`21_600_000` ms), clave de storage `cmpCache`, máximo 3000 entradas, guarda ofertas y `"missing"`, nunca `"error"`.
- Consultas: 1 búsqueda cada 50 EAN por súper (`_from=0&_to=49`), máximo 4 consultas a la vez por súper, 8 s de tiempo máximo por consulta.
- Espera del cliente antes de mandar un lote: 150 ms.
- Solo agregar nodos y atributos `data-coto-unit-*`; nunca tocar nodos de Coto.
- Textos en español rioplatense, cortos. Formato de plata: `"$" + new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(n)`.
- Versión `0.5.0` en `manifest.json`.

## Review Focus

1. **EAN que no es el mismo producto** (Coto o el otro súper cargó mal el código, o el otro vende un pack): una persona espera no ver "$300 ▼" contra un producto de $3000. Regla: si `otro / coto` está fuera de `[0.4, 2.5]`, la fila muestra "—" con título "Dato dudoso". Test en Task 6.
2. **EAN raro de Coto** (`""`, `"0"`, con letras, número en vez de texto): no se compara y no se manda nada al fondo. Test en Task 2.
3. **Tarjeta reusada por Angular con otro producto**: el bloque de comparación tiene que cambiar al EAN nuevo, no quedar el viejo. Test en Task 6.
4. **El súper limita la cantidad por pedido** (simulación devuelve `quantity` menor que la pedida): esa q no cuenta. Test en Task 1.
5. **El usuario apaga "Comparar con otros súper" con pedidos en vuelo**: no se pinta nada cuando llega la respuesta y los bloques existentes se borran. Test en Task 6.

---

### Task 1: Lectura de APIs VTEX (`stores.js`, `vtex.js`) y fixtures reales

**Files:**
- Create: `src/stores.js`, `src/vtex.js`, `scripts/capture-vtex-fixtures.mjs`, `tests/vtex.test.js`
- Create (generados): `tests/fixtures/vtex-carrefour.json`, `tests/fixtures/vtex-dia.json`, `tests/fixtures/vtex-mas.json`
- Modify: `package.json` (script `"fixtures:vtex": "node scripts/capture-vtex-fixtures.mjs"`)

**Interfaces:**
- Produces:
  - `STORES: Array<{ id: string, name: string, host: string, sc: number }>` (Global Constraints).
  - `searchUrl(store, eans: string[]) → string` — repite `fq=alternateIds_Ean:<ean>` por EAN, agrega `&_from=0&_to=49`.
  - `parseSearch(json) → Map<ean, Hit>`; `Hit = { itemId: string, seller: string, price: number, stock: number, name: string }`. Recorre todos los `items` de cada producto y usa `item.ean`; `seller` y `price`/`stock` salen de `sellers[0]` (`sellerId`, `commertialOffer.Price`, `commertialOffer.AvailableQuantity`). JSON que no es array → `Map` vacío.
  - `simulationRequest(store, hit, q) → { url: string, init: RequestInit }` — `POST https://<host>/api/checkout/pub/orderForms/simulation?sc=<sc>`, body `{ items: [{ id, quantity: q, seller }], country: "ARG" }`, header `content-type: application/json`.
  - `parseSimulation(json, q) → { total: number, promo: string | null } | null` — `total = Σ totals[].value / 100`; `null` si no hay `items[0]`, si `items[0].quantity !== q`, si `items[0].availability !== "available"` o si `total <= 0`. `promo` = nombres de `ratesAndBenefitsData.rateAndBenefitsIdentifiers` unidos con `" · "`, o `null`.
  - `bestOffer(hit, sims: { 1?: Sim|null, 2?: Sim|null, 3?: Sim|null }) → Offer | null`; `Offer = { unit: number, qty: number, promo: string | null }`. `null` si `hit.stock <= 0`. q = 1 usa `sims[1]` o, si es `null`, `hit.price` (sin promo). `unit` redondeado a 2 decimales. Empate → la q más chica.

- [ ] **Step 1: Escribir `scripts/capture-vtex-fixtures.mjs`**

Para cada súper de `STORES`: una búsqueda con los 5 EAN `7790060023684`, `7793704000928`, `7790742348302`, `7790895000997`, `7790070336309` y, por cada hit, simulaciones con q 1, 2 y 3. Guarda `tests/fixtures/vtex-<id>.json` con forma `{ capturedAt, search: <json>, sims: { "<ean>:<q>": <json> } }`. Header `user-agent: Mozilla/5.0`.

- [ ] **Step 2: Correr la captura**

Run: `npm run fixtures:vtex`
Expected: 3 archivos nuevos; cada uno con 5 productos en `search` y 15 entradas en `sims`.

- [ ] **Step 3: Escribir los tests que fallan** (`tests/vtex.test.js`)

Con objetos chicos armados a mano:
- `searchUrl` con 2 EAN contiene dos veces `fq=alternateIds_Ean:` y termina en `&_from=0&_to=49`.
- `parseSearch` encuentra el EAN en el segundo `item` de un producto; devuelve `{ itemId: "2", seller: "1", price: 2225, stock: 291, name: … }`.
- `parseSearch({ error: 1 })` → `Map` vacío.
- `parseSimulation` de `{ items: [{ quantity: 2, availability: "available" }], totals: [{ value: 445000 }, { value: -65000 }], ratesAndBenefitsData: { rateAndBenefitsIdentifiers: [{ name: "Llevando 2 a $1899 c/u" }] } }` con q 2 → `{ total: 3800, promo: "Llevando 2 a $1899 c/u" }`.
- `parseSimulation` → `null` cuando `items[0].quantity` es 1 y se pidió 3 (Review Focus 4), cuando `availability` es `"cannotBeDelivered"` y cuando el total es 0.
- `bestOffer(hit $2225, { 1: {total: 2225}, 2: {total: 3798, promo: "Llevando 2…"}, 3: {total: 6023} })` → `{ unit: 1899, qty: 2, promo: "Llevando 2…" }`.
- `bestOffer` con `sims[1] = null` usa `hit.price`; con `stock: 0` → `null`; con q 1 y q 2 iguales por unidad → `qty: 1`.
- Smoke test con los 3 fixtures reales: para cada EAN de `search`, `bestOffer(hit, sims parseados)` da `unit > 0` y `qty ∈ {1,2,3}`.

- [ ] **Step 4: Correr y ver que falla**

Run: `npx vitest run tests/vtex.test.js`
Expected: FAIL, módulos no existen.

- [ ] **Step 5: Implementar `src/stores.js` y `src/vtex.js`** con las firmas de arriba.

- [ ] **Step 6: Correr y ver que pasa**

Run: `npx vitest run tests/vtex.test.js`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/stores.js src/vtex.js scripts/capture-vtex-fixtures.mjs tests/vtex.test.js tests/fixtures/vtex-*.json package.json
git commit -m "feat: leer busqueda y carrito simulado de Carrefour, Dia y Mas"
```

---

### Task 2: Precio de Coto para comparar y EAN en etiquetas y carrito

**Files:**
- Create: `src/compare.js`, `tests/compare.test.js`
- Modify: `src/sort.js:41-53` (`labelsFor`), `src/cart.js:49-50` (`analyzeCart`)
- Test: `tests/sort.test.js`, `tests/cart.test.js` (sumar casos)

**Interfaces:**
- Consumes: `finalPrice(data, store)`, `takeQty(data, store)` de `src/unit-price.js`.
- Produces:
  - `validEan(value) → string | null` — `String(value).trim()` que cumple `/^\d{8,14}$/` y no es todo ceros; si no, `null`.
  - `compareFields(data, store) → { ean: string | null, cmp: { unit: number, qty: number } | null }` — `ean = validEan(data.product_main_ean)`; `cmp = null` si no hay `ean`, si es pesable (`Number(product_weighable) === 1` o `product_unit_of_measure === "KGS"`) o si `finalPrice` es `null`; si no, `{ unit: finalPrice, qty: takeQty }`.
  - `classify(cotoUnit: number, otherUnit: number) → "lower" | "equal" | "higher"` (Global Constraints).
  - Cada etiqueta de `labelsFor` y cada línea de `analyzeCart(...).lines` suma `ean` y `cmp`.

- [ ] **Step 1: Escribir los tests que fallan**

`tests/compare.test.js`:
- `validEan("7790742348302") === "7790742348302"`; `validEan(7790742348302) === "7790742348302"`; `validEan("")`, `validEan("0")`, `validEan("00000000")`, `validEan("77ABC")`, `validEan(undefined)` → `null` (Review Focus 2).
- `compareFields` con oferta "Llevando 2" a $1899 y lista $2225 → `{ ean, cmp: { unit: 1899, qty: 2 } }`.
- `compareFields` pesable → `cmp: null`; sin EAN → `{ ean: null, cmp: null }`.
- `classify(1000, 989) === "lower"`, `classify(1000, 990) === "equal"`, `classify(1000, 1010) === "equal"`, `classify(1000, 1011) === "higher"`.

En `tests/sort.test.js`: `labelsFor` con un resultado que tiene `product_main_ean` → la etiqueta tiene `ean` y `cmp.unit`.
En `tests/cart.test.js`: una línea con `data` y EAN → `analyzeCart(...).lines[0].ean` y `.cmp` presentes; línea sin `data` → `ean: null, cmp: null`.

- [ ] **Step 2: Correr y ver que falla**

Run: `npx vitest run tests/compare.test.js tests/sort.test.js tests/cart.test.js`
Expected: FAIL.

- [ ] **Step 3: Implementar `src/compare.js` y sumar `...compareFields(data, store)` en `labelsFor` y en cada línea de `analyzeCart`** (en el carrito, `data` puede ser `null` → `{ ean: null, cmp: null }`).

- [ ] **Step 4: Correr toda la suite**

Run: `npm test`
Expected: PASS (los tests viejos siguen pasando).

- [ ] **Step 5: Commit**

```bash
git add src/compare.js src/sort.js src/cart.js tests/compare.test.js tests/sort.test.js tests/cart.test.js
git commit -m "feat: EAN y precio Coto para comparar en etiquetas y carrito"
```

---

### Task 3: Memoria de precios (`price-cache.js`)

**Files:**
- Create: `src/price-cache.js`, `tests/price-cache.test.js`

**Interfaces:**
- Produces: `createPriceCache(storage, now = Date.now, { ttlMs = 21_600_000, max = 3000 } = {}) → { get(keys: string[]): Promise<Record<string, Offer | "missing">>, set(entries: Record<string, Offer | "missing">): Promise<void> }`.
  - `storage` = `{ get(keys) → Promise<obj>, set(obj) → Promise }` (como `chrome.storage.local`).
  - Guarda todo bajo `cmpCache` como `{ [key]: { at: number, v } }`. Clave: `"<storeId>:<ean>"`.
  - `get` omite entradas vencidas. `set` ignora valores `"error"`, y al pasar `max` borra las de `at` más viejo.
  - Las escrituras se hacen en cadena (una promesa detrás de otra) para no pisarse.

- [ ] **Step 1: Escribir los tests que fallan**

Con un `storage` falso en memoria y `now` controlable:
- `set({ "dia:1": offer })` y `get(["dia:1", "dia:2"])` → `{ "dia:1": offer }`.
- Después de `now + 21_600_001` → `get` devuelve `{}`.
- `set({ "dia:1": "missing" })` se guarda; `set({ "dia:2": "error" })` no.
- Con `max: 2`, tres `set` en tiempos distintos → queda fuera la más vieja.
- Dos `set` sin `await` entre medio → las dos claves quedan guardadas.

- [ ] **Step 2: Correr y ver que falla**

Run: `npx vitest run tests/price-cache.test.js`
Expected: FAIL.

- [ ] **Step 3: Implementar `src/price-cache.js`.**

- [ ] **Step 4: Correr y ver que pasa**

Run: `npx vitest run tests/price-cache.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/price-cache.js tests/price-cache.test.js
git commit -m "feat: memoria de 6 h para precios de otros super"
```

---

### Task 4: Servicio de comparación y service worker

**Files:**
- Create: `src/compare-service.js`, `src/background.js`, `tests/compare-service.test.js`
- Modify: `manifest.json`, `build.mjs`

**Interfaces:**
- Consumes: `STORES`, `searchUrl`, `parseSearch`, `simulationRequest`, `parseSimulation`, `bestOffer` (Task 1); `createPriceCache` (Task 3); `validEan` (Task 2).
- Produces:
  - `createCompareService({ fetch, cache, stores = STORES, concurrency = 4, timeoutMs = 8000 }) → { compare(eans: string[]): Promise<Result> }`.
  - `Result = { [ean]: { [storeId]: Offer | "missing" | "error" } }`.
  - Mensaje: `chrome.runtime.sendMessage({ type: "compare", eans })` → responde `Result` (o `{}` si algo explota).

Comportamiento de `compare`:
1. Filtra con `validEan`, saca repetidos, máximo 200 EAN por llamada.
2. Por súper, en paralelo: lee la memoria; los que faltan van en lotes de 50 a una búsqueda.
3. Búsqueda fallida (excepción, `!res.ok`, JSON roto, tiempo agotado) → `"error"` para todo el lote.
4. EAN no encontrado o `bestOffer` → `null` → `"missing"`. Encontrado → 3 simulaciones (q 1, 2, 3); una simulación fallida cuenta como `null` para esa q.
5. Toda consulta pasa por un limitador de 4 a la vez por súper. Tiempo máximo con `AbortSignal.timeout(timeoutMs)`.
6. Pedidos en vuelo por `"<storeId>:<ean>"` se comparten entre llamadas.
7. Guarda en memoria solo ofertas y `"missing"`.

- [ ] **Step 1: Escribir los tests que fallan**

Con `fetch` falso que responde según URL y método, y `createPriceCache` sobre storage en memoria:
- 1 EAN encontrado en los 3 súper → `Result[ean]` tiene `carrefour`, `dia`, `mas` con `unit`; se hicieron 1 búsqueda + 3 simulaciones por súper.
- 60 EAN → 2 búsquedas por súper.
- Contador de consultas activas por host nunca pasa de 4.
- Segunda `compare` con el mismo EAN → 0 llamadas a `fetch`.
- Dos `compare` simultáneas con el mismo EAN → 1 búsqueda por súper.
- Búsqueda con HTTP 500 en `dia` → `dia: "error"`, los otros bien, y una tercera `compare` vuelve a consultar `dia`.
- EAN que no vuelve en la búsqueda → `"missing"`.
- `compare(["abc", "", "7790742348302", "7790742348302"])` → solo una clave en `Result`.

- [ ] **Step 2: Correr y ver que falla**

Run: `npx vitest run tests/compare-service.test.js`
Expected: FAIL.

- [ ] **Step 3: Implementar `src/compare-service.js`.**

- [ ] **Step 4: Implementar `src/background.js`**

Crea `createPriceCache(chrome.storage.local)` y `createCompareService({ fetch: globalThis.fetch.bind(globalThis), cache })`. En `chrome.runtime.onMessage.addListener((m, _sender, reply) => …)`: si `m?.type !== "compare"` devuelve `undefined`; si no, `compare(m.eans).then(reply, () => reply({}))` y devuelve `true` (respuesta asíncrona).

- [ ] **Step 5: Manifest y build**

`manifest.json`: `"version": "0.5.0"`, `"host_permissions": ["https://www.carrefour.com.ar/*", "https://diaonline.supermercadosdia.com.ar/*", "https://www.masonline.com.ar/*"]`, `"background": { "service_worker": "dist/background.js" }`. Descripción: sumar "y lo compara con Carrefour, Día y Más". `build.mjs`: bundle `src/background.js` → `dist/background.js`.

- [ ] **Step 6: Correr tests y build**

Run: `npm test && npm run build`
Expected: PASS y `dist/background.js` existe.

- [ ] **Step 7: Commit**

```bash
git add src/compare-service.js src/background.js tests/compare-service.test.js manifest.json build.mjs
git commit -m "feat: service worker que compara precios por EAN"
```

---

### Task 5: Cliente en la página que agrupa pedidos (`compare-client.js`)

**Files:**
- Create: `src/compare-client.js`, `tests/compare-client.test.js`

**Interfaces:**
- Produces: `createCompareClient({ send, delayMs = 150, setTimer = setTimeout }) → { request(ean: string): Promise<StoreResults>, peek(ean): StoreResults | undefined }`.
  - `send(eans: string[]) → Promise<Result>` (en producción: `chrome.runtime.sendMessage({ type: "compare", eans })`).
  - `StoreResults = { [storeId]: Offer | "missing" | "error" }`. Si `send` falla o el EAN no viene → `{}` (la UI trata súper sin clave como `"error"`).
  - Junta los EAN pedidos durante `delayMs` y hace un solo `send`. Un EAN ya pedido o ya resuelto no se vuelve a mandar (los resultados duran lo que dura la página).

- [ ] **Step 1: Escribir los tests que fallan**
- 3 `request` en el mismo tick → 1 `send` con 3 EAN.
- `request` de un EAN ya resuelto → no llama a `send`; `peek` lo devuelve.
- `send` rechaza → las promesas resuelven `{}`, no rechazan.

- [ ] **Step 2: Correr y ver que falla**

Run: `npx vitest run tests/compare-client.test.js`
Expected: FAIL.

- [ ] **Step 3: Implementar `src/compare-client.js`.**

- [ ] **Step 4: Correr y ver que pasa**

Run: `npx vitest run tests/compare-client.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/compare-client.js tests/compare-client.test.js
git commit -m "feat: cliente que agrupa pedidos de comparacion"
```

---

### Task 6: Filas de comparación en tarjetas, ficha y carrusel

**Files:**
- Create: `src/compare-ui.js`, `tests/compare-ui.test.js`
- Modify: `src/badge.js` (`installBadges`, `paintBox`, manejo de `settings`), `src/badge-entry.js`, `src/bridge.js:3` y `sendSettings`, `src/badge.css`
- Test: `tests/badge.test.js`, `tests/bridge.test.js` (sumar casos)

**Interfaces:**
- Consumes: `STORES` (Task 1), `classify` (Task 2), `createCompareClient` (Task 5).
- Produces:
  - `compareRows(cmp: { unit, qty }, results: StoreResults | undefined, stores = STORES) → Row[]`; `Row = { id, name, state: "lower"|"equal"|"higher"|"none"|"pending", unit: number|null, qty: number, title: string|null }`.
    - `results` `undefined` → todas `"pending"`.
    - `"missing"` → `"none"`, título `"No está en <name>"`; `"error"` o sin clave → `"none"`, título `"No se pudo consultar <name>"`.
    - Oferta con `unit / cmp.unit` fuera de `[0.4, 2.5]` → `"none"`, título `"Dato dudoso"` (Review Focus 1).
    - Si no, `state = classify(cmp.unit, offer.unit)`.
  - `paintCompare(box, rows, variant: "" | "pdp" | "mini")` — crea o actualiza `.coto-unit-cmp` como último hijo de `box`. `rows` vacío o `null` → borra el bloque.
    - Variante `""` y `"pdp"`: una `.coto-unit-cmp-row` por súper con clase `--lower|--equal|--higher|--none|--pending`; texto del nombre, después ícono + precio: `▼ $1.899`, `= $2.229`, `▲ $2.600`, `—`, `…`. Si `qty > 1`, una `.coto-unit-cmp-qty` "llevando 2". `aria-label` de la fila: `"Día: $1.899, más barato"` / `"igual"` / `"más caro"`; `title` = `row.title`.
    - Variante `"mini"`: una sola `.coto-unit-cmp-best`. Si alguna fila es `"lower"`: la de menor `unit`, texto `"Día $1.899 ▼"`, clase `--lower`. Si no hay `"lower"` pero hay al menos una con dato: `"Coto el más barato"`, clase `--higher`. Si todas son `"none"`: borra el bloque. Si todas `"pending"`: `"…"`.
  - `installBadges(win, doc, { compare } = {})` — `compare` es un cliente de Task 5; sin `compare`, no hay comparación.
  - Mensaje `settings` suma `compareStores: boolean` (default `true`), leído de storage key `compareStores`.

Cableado en `badge.js`:
- `state.compare = true` hasta que `settings` diga lo contrario. Con `false`: borrar todos los `.coto-unit-cmp` y no pedir nada; respuestas que llegan después no pintan (Review Focus 5).
- En `paintBox`, si hay `compare`, `state.compare`, `label.ean` y `label.cmp`: `box.setAttribute("data-coto-unit-ean", ean)`; si el EAN cambió respecto del anterior, borrar `.coto-unit-cmp` (Review Focus 3). Pintar con `compare.peek(ean)` (o `"pending"`). Si no hay resultado, pedir: con `win.IntersectionObserver` observar la caja y llamar `compare.request(ean)` la primera vez que entra en pantalla; sin `IntersectionObserver`, pedir enseguida. Al resolver, volver a `render()`.
- Sin `ean`/`cmp` → borrar `.coto-unit-cmp`.
- `badge-entry.js`: `const compare = createCompareClient({ send: (eans) => chrome.runtime.sendMessage({ type: "compare", eans }) });` y pasarlo a `installBadges` (y a `installCartUi` en Task 7).
- `badge.css`: `.coto-unit-cmp` con borde fino arriba, `font-size: 12px`, filas `display: flex; justify-content: space-between`, `font-variant-numeric: tabular-nums`; `--lower` `#A32D2D`, `--higher` `#3B6D11`, `--equal`/`--none`/`--pending` `#5F5E5A`; `.coto-unit-cmp-qty` 11px alineado a la derecha. En `--pdp` 13px.

- [ ] **Step 1: Escribir los tests que fallan**

`tests/compare-ui.test.js` (jsdom):
- `compareRows({unit: 2225, qty: 1}, { carrefour: {unit: 2049, qty: 1}, dia: {unit: 1899, qty: 2, promo: "x"}, mas: {unit: 2229, qty: 1} })` → estados `lower`, `lower`, `equal`.
- `"missing"` → `none` con `"No está en Día"`; sin clave → `"No se pudo consultar Más"`; `undefined` → 3 `pending`.
- Oferta `unit: 300` contra Coto `3000` → `none`, `"Dato dudoso"`.
- `paintCompare` normal: 3 filas, texto `"▼ $1.899"`, una `.coto-unit-cmp-qty` "llevando 2", `aria-label` `"Día: $1.899, más barato"`.
- `paintCompare` mini: `"Día $1.899 ▼"`; sin `lower` → `"Coto el más barato"`; todas `none` → no hay bloque.
- Pintar dos veces con los mismos datos no duplica nodos.

`tests/badge.test.js` (con un `compare` falso que guarda pedidos y resuelve a mano):
- Etiqueta con `ean` y `cmp` → caja tiene `.coto-unit-cmp` con 3 filas `…`; al resolver, filas con precio.
- Etiqueta sin `ean` → no hay `.coto-unit-cmp` ni pedido.
- Misma tarjeta, la etiqueta cambia a otro EAN → el bloque muestra el EAN nuevo, no el viejo.
- Mensaje `settings` con `compareStores: false` → se borran los bloques; un pedido que resuelve después no pinta.

`tests/bridge.test.js`: con `compareStores: false` en storage, el mensaje `settings` trae `compareStores: false`; sin la clave, `true`.

- [ ] **Step 2: Correr y ver que falla**

Run: `npx vitest run tests/compare-ui.test.js tests/badge.test.js tests/bridge.test.js`
Expected: FAIL.

- [ ] **Step 3: Implementar `src/compare-ui.js`, cablear `badge.js`, `badge-entry.js`, `bridge.js` y `badge.css`.**

- [ ] **Step 4: Correr toda la suite y el build**

Run: `npm test && npm run build`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/compare-ui.js src/badge.js src/badge-entry.js src/bridge.js src/badge.css tests/compare-ui.test.js tests/badge.test.js tests/bridge.test.js
git commit -m "feat: filas de comparacion con otros super en cada producto"
```

---

### Task 7: Comparación en el carrito

**Files:**
- Modify: `src/cart-ui.js` (`installCartUi`, nuevo `renderCompare`), `src/badge-entry.js`
- Test: `tests/cart-ui.test.js`

**Interfaces:**
- Consumes: `compareRows`, `paintCompare` (Task 6); líneas de `analyzeCart` con `ean` y `cmp` (Task 2); cliente de Task 5.
- Produces: `installCartUi(win, doc, { compare } = {})`.

En `/carrito`, por cada `card-product` que matchea una línea por nombre (igual que `renderWarnings`) y tiene `ean` y `cmp`: pedir `compare.request(ean)` y pintar con `paintCompare(target, compareRows(line.cmp, results), "mini")` dentro de `.c__item-detail`. Respeta `compareStores` del mensaje `settings` igual que en Task 6.

- [ ] **Step 1: Escribir los tests que fallan**
- Carrito con una línea con EAN → al resolver, `.coto-unit-cmp-best` con `"Día $1.899 ▼"` dentro de `.c__item-detail`.
- Línea sin EAN → sin bloque.
- `compareStores: false` → sin bloque.

- [ ] **Step 2: Correr y ver que falla**

Run: `npx vitest run tests/cart-ui.test.js`
Expected: FAIL.

- [ ] **Step 3: Implementar y pasar `compare` desde `badge-entry.js`.**

- [ ] **Step 4: Correr toda la suite**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/cart-ui.js src/badge-entry.js tests/cart-ui.test.js
git commit -m "feat: mejor precio de otro super en cada linea del carrito"
```

---

### Task 8: Popup, textos de producto y prueba manual

**Files:**
- Modify: `src/popup.js` (`SETTINGS`, `HELP`, `helpView`, `storage.get` de la línea 172), `PRODUCT.md`, `README.md`

**Interfaces:**
- Consumes: storage key `compareStores` (Task 6).

- [ ] **Step 1: Popup**
- `SETTINGS` suma `{ key: "compareStores", title: "Comparar con otros súper", text: "Muestra el precio en Carrefour, Día y Más. ▼ ahí es más barato, = igual, ▲ más caro." }` y la clave se suma al `storage.get`.
- `HELP` suma `["Otros súper", "Precio del mismo producto (mismo código de barras) en la web de Carrefour, Día y Más, zona por defecto. Puede variar en tu sucursal. Sin descuentos bancarios. \"llevando 2\": precio por unidad con su promo."]`.
- Texto legal de `helpView`: `" Usa los datos de coto.com.ar. Para comparar, solo envía códigos de barras a Carrefour, Día y Más."`

- [ ] **Step 2: `PRODUCT.md` y `README.md`**
- `PRODUCT.md`, Positioning: cambiar "It does not send data anywhere else." por "To compare, it only sends barcodes (EAN) to the public APIs of Carrefour, Día and Más; no own servers, no personal data."
- `PRODUCT.md`, Capabilities: cambiar "No host permissions, no external servers." por "Host permissions only for Carrefour, Día and Más; no own servers."
- `README.md`: una línea en la descripción sobre la comparación y `npm run fixtures:vtex` en Desarrollo.

- [ ] **Step 3: Tests y build**

Run: `npm test && npm run build`
Expected: PASS.

- [ ] **Step 4: Prueba manual**

Cargar la carpeta en `chrome://extensions` (recargar la extensión). Revisar en coto.com.ar:
- Una categoría (ej. leches): cada tarjeta muestra 3 filas; al bajar, las de abajo pasan de "…" a precios.
- Una ficha de producto: filas a lo ancho.
- Carrusel "También te pueden interesar": una línea.
- `/carrito`: una línea por producto.
- Apagar "Comparar con otros súper" en el popup: los bloques desaparecen.
- Agregar al carrito, cambiar cantidades y ordenar por precio por kg siguen andando igual.

- [ ] **Step 5: Commit**

```bash
git add src/popup.js PRODUCT.md README.md
git commit -m "feat: ajuste y ayuda para comparar con otros super"
```
