# Carrito comparado, elegir súper y bancos de otros súper: plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** En el carrito de Coto se ve cuánto cuesta la misma compra en Carrefour, Día y Más (los que el usuario prenda), sin banco y con sus tarjetas, y dónde conviene comprar hoy.

**Architecture:** Módulos puros y chicos (parsers de promos, reglas a mano, cuenta del carrito) más cableado fino en el service worker (`background.js`), el puente (`bridge.js`), el popup y `cart-ui.js`. El service worker hace todos los pedidos a los otros súper; la página solo recibe resultados. Lo dudoso no se resta: se muestra con un enlace.

**Tech Stack:** JavaScript (ES modules), Chrome MV3, esbuild (IIFE), vitest + jsdom. Sin dependencias nuevas.

**Spec:** `docs/superpowers/specs/2026-11-11-carrito-comparado-y-bancos-design.md`

## Global Constraints

- Sin permisos nuevos en `manifest.json`. Versión final `0.15.0` (manifest y package).
- Todo pedido a otro súper: `credentials: "omit"`, tiempo máximo 8 s, sin datos personales.
- Solo se agregan nodos al DOM de Coto. Nunca se tocan ni se mueven nodos de Coto.
- Solo promos de compra online. Solo una promo en estado `"ok"` se resta de un total.
- Textos en español rioplatense, cortos. Plata con `$0` / `$2` de `src/cart-summary.js`.
- Sin APIs de `chrome` dentro de módulos puros: se inyectan (`fetch`, `storage`, `send`), como en `compare-service.js`.
- Tolerancia de comparación: 1%. Dato dudoso: precio por unidad fuera de `[0.4, 2.5]` veces el de Coto.
- Cada tarea termina con `npm test` en verde y un commit. Sin líneas de atribución en los commits.
- Clases CSS nuevas con prefijo `coto-unit-` (página) o las del popup existentes.

## Review Focus

1. La simulación de VTEX devuelve menos productos que los pedidos, o en otro orden → se cruza por `id` de producto, nunca por posición; lo que no vuelve es faltante. (Tarea 9)
2. `cards` en storage con una tarjeta o plan que ya no existe, o con forma rota → se ignora esa entrada, no rompe el popup ni el carrito. (Tarea 3)
3. El usuario apaga un súper con un pedido en vuelo → la respuesta de ese súper no se pinta. (Tareas 2 y 11)
4. Día de compra elegido distinto de hoy → la promo del otro súper se elige por ese día de la semana, no por hoy. (Tarea 10)
5. Carrito con más de 50 productos → la búsqueda va en lotes de 50 y la simulación sigue siendo una por súper. (Tarea 9)

## Mapa de archivos

| Archivo | Responsabilidad |
|---|---|
| `scripts/capture-bank-fixtures.mjs` (nuevo) | Baja promos reales de los 3 súper y una simulación de carrito |
| `src/stores.js` | Suma `promosUrl` y `enabledStores(settings)` |
| `src/cards.js` (nuevo) | Lista de tarjetas y planes, `applies`, `cleanCards`, `migrateCards` |
| `src/bank-rules/coto.js`, `mas.js`, `dia.js`, `carrefour.js` (nuevos) | Reglas a mano: `cardOf` y `exclusions` |
| `src/bank-rules/hash.js` (nuevo) | `exclusionText`, `hashOf`, `statusOf` |
| `src/bank-promos/mas.js`, `dia.js`, `carrefour.js` (nuevos) | Parsers puros a la forma `Promo` |
| `src/bank-promos/service.js` (nuevo) | Baja, guarda 24 h y filtra las promos |
| `src/vtex.js`, `src/compare-service.js` | Simulación de carrito entero; filtro por súper; `cartCompare` |
| `src/cart.js` | Las líneas suman `bankEligible`, `brand`, `groups` |
| `src/cart-compare.js` (nuevo) | La cuenta por súper y la respuesta de arriba |
| `src/cart-compare-ui.js` (nuevo) | Pinta el bloque de /carrito y la línea del mini-carrito |
| `src/popup-cards.js` (nuevo) | Pestaña Tarjetas (sale de `popup.js`) |
| `src/popup.js`, `src/bridge.js`, `src/background.js`, `src/badge-entry.js`, `src/cart-ui.js`, `src/badge.js`, `src/compare-client.js` | Cableado |

Forma común `Promo` (la usan las tareas 5 a 10):

```js
{ id: string, store: "mas" | "dia" | "carrefour", bankLabel: string, title: string,
  percent: number | null, cap: number | null, capPeriod: "tx" | "week" | "month" | null,
  minPurchase: number | null, days: number[] /* 0 = domingo */, from: string | null, to: string | null,
  online: boolean, direct: boolean, legal: string }
```

---

### Task 1: Capturas reales de promos y de un carrito

**Files:**
- Create: `scripts/capture-bank-fixtures.mjs`
- Modify: `package.json` (script `"fixtures:bank": "node scripts/capture-bank-fixtures.mjs"`)
- Create (salida del script): `tests/fixtures/bank-mas.json`, `tests/fixtures/bank-dia.html`, `tests/fixtures/bank-carrefour.html`, `tests/fixtures/vtex-cart.json`

**Interfaces:**
- Produces: los cuatro archivos. `bank-mas.json` = `{ capturedAt, promos, banks }`. `vtex-cart.json` = `{ capturedAt, [storeId]: { search, simulation } }` con los 5 EAN de `scripts/capture-vtex-fixtures.mjs`, cantidades `[1, 2, 3, 1, 2]`, todos en un solo pedido de simulación.

- [ ] **Step 1: Escribir el script**, con el estilo de `scripts/capture-vtex-fixtures.mjs` (`fetch` de Node, `user-agent: Mozilla/5.0`). URLs:
  - Más promos: `https://www.masonline.com.ar/_v/private/gdn-services/content/banks-promotions?_fields=id,title,sub_title,discount_percentage,discount_text_info,active,active_from,active_to,ecommerce,monday,tuesday,wednesday,thursday,friday,saturday,sunday,idBank,idCard,legal&_from=0&_to=99`
  - Más bancos: `https://www.masonline.com.ar/_v/private/gdn-services/content/financing-banks?_fields=id,name&_from=0&_to=99`
  - Día: `https://diaonline.supermercadosdia.com.ar/medios-de-pago-y-promociones`
  - Carrefour: `https://www.carrefour.com.ar/descuentos-bancarios`
- [ ] **Step 2: Correrlo.** Run: `npm run fixtures:bank`. Expected: imprime una línea por archivo con su tamaño; ningún HTTP distinto de 200.
- [ ] **Step 3: Revisar Carrefour.** Buscar en `tests/fixtures/bank-carrefour.html` el texto `discount_percentage`. Anotar el resultado en el mensaje del commit: "Carrefour: datos en el HTML" o "Carrefour: sin datos en el HTML". La Tarea 7 depende de esto.
- [ ] **Step 4: Commit.** `git add scripts/capture-bank-fixtures.mjs package.json tests/fixtures/bank-* tests/fixtures/vtex-cart.json` · `git commit -m "test: capturas de promos de banco y de un carrito simulado"`

---

### Task 2: Elegir súper

**Files:**
- Modify: `src/stores.js`, `src/compare-service.js`, `src/compare-client.js`, `src/bridge.js`, `src/background.js`, `src/badge-entry.js`, `src/badge.js`, `src/cart-ui.js`, `src/popup.js`, `src/popup.css`
- Test: `tests/stores.test.js` (nuevo), `tests/compare-service.test.js`, `tests/compare-client.test.js`, `tests/bridge.test.js`

**Interfaces:**
- Produces:
  - `enabledStores(s) → Store[]`: `[]` si `s.compareStores === false`; si no, `STORES` sin los ids de `s.storesOff`. `storesOff` que no es array = `[]`.
  - Cada `Store` suma `promosUrl` (Carrefour `https://www.carrefour.com.ar/descuentos-bancarios`, Día `https://diaonline.supermercadosdia.com.ar/medios-de-pago-y-promociones`, Más `https://www.masonline.com.ar/promociones-bancarias`).
  - `service.compare(eans, storeIds?)`: `storeIds` indefinido = todos. El resultado solo trae los súper pedidos.
  - `createCompareService({ …, onStatus })`: `onStatus(storeId, ok: boolean)` después de cada búsqueda.
  - `createCompareClient({ send, stores })`: `send(eans, stores())`; método nuevo `reset()` que vacía `done`.
  - Mensaje `{ type: "compare", eans, stores }`. Mensaje `settings` del puente suma `stores: string[]`.
  - Storage: `storesOff: string[]`, `storeStatus: { [storeId]: "error" }`.

- [ ] **Step 1: Tests que fallan.**

```js
// tests/stores.test.js
expect(enabledStores({}).map((s) => s.id)).toEqual(["carrefour", "dia", "mas"]);
expect(enabledStores({ storesOff: ["mas"] }).map((s) => s.id)).toEqual(["carrefour", "dia"]);
expect(enabledStores({ compareStores: false })).toEqual([]);
expect(enabledStores({ storesOff: "x" }).length).toBe(3);
// tests/compare-service.test.js
const out = await service.compare([EAN], ["dia"]);
expect(Object.keys(out[EAN])).toEqual(["dia"]);
expect(calls.every((c) => c.host === "diaonline.supermercadosdia.com.ar")).toBe(true);
// onStatus: con fail: ["www.carrefour.com.ar"] se llama onStatus("carrefour", false) y onStatus("dia", true)
// tests/compare-client.test.js
// send recibe (eans, ["dia"]); después de reset(), request(ean) vuelve a llamar a send
// tests/bridge.test.js
// con { storesOff: ["mas"] } el mensaje settings trae stores: ["carrefour", "dia"]; un cambio de storesOff reenvía
```

- [ ] **Step 2: Verlos fallar.** Run: `npx vitest run tests/stores.test.js tests/compare-service.test.js tests/compare-client.test.js tests/bridge.test.js`. Expected: FAIL en los casos nuevos.
- [ ] **Step 3: Implementar** lo de Interfaces. `background.js`: pasa `m.stores` a `compare` y, en `onStatus`, guarda o borra la entrada de `storeStatus`. `badge-entry.js`: lee `compareStores` y `storesOff` de `chrome.storage.local`, los sigue con `onChanged` y llama `compare.reset()` cuando cambia la lista. `badge.js` y `cart-ui.js`: guardan `state.stores` del mensaje `settings`, se lo pasan a `compareRows(cmp, results, stores)` como `Store[]` y repintan.
- [ ] **Step 4: Popup.** En `settingsView`, sección `datos`: debajo de la fila `compareStores`, una fila con interruptor por súper (`data-store="<id>"`, clase `row row--sub`). Cambiar una escribe `storesOff`. Con `compareStores` apagado, las filas llevan `disabled`. Si `storeStatus[id] === "error"`, la fila suma el texto "No responde". `renderPopup` lee además `storesOff` y `storeStatus`. Tests en `tests/bridge.test.js` (bloque `popup`): apagar "Día" guarda `{ storesOff: ["dia"] }`; con `compareStores: false` los tres están `disabled`; con `storeStatus: { mas: "error" }` la fila de Más contiene "No responde".
- [ ] **Step 5: Todo en verde.** Run: `npm test`. Expected: PASS.
- [ ] **Step 6: Commit.** `git commit -am "feat: elegir con qué súper se compara"` (sumar los archivos nuevos con `git add`).

---

### Task 3: Tarjetas y planes (modelo)

**Files:**
- Create: `src/cards.js`, `src/bank-rules/coto.js`
- Modify: `src/bridge.js`
- Test: `tests/cards.test.js` (nuevo), `tests/bank-rules-coto.test.js` (nuevo), `tests/bridge.test.js`

**Interfaces:**
- Produces:
  - `CARDS: [{ id, name, plans: [{ id, name }] }]`. Mínimo: `icbc` (plan `sueldo` "Plan Sueldo"), `supervielle` (`identite` "Identité"), `naranjax` (`inicial`, `turbo`, `epico`), `columbia`, `tci`, `patagonia`, `ciudad`, `credicoop`, `comafi`, `galicia`, `nacion`, `macro`, `santander`, `bbva`, `modo`, `mercadopago`, `personalpay`, `cuentadni`, `bancodelsol`, `carrefourbanco`, `masclub`. Sin planes = `plans: []`.
  - `cleanCards(value) → { [cardId]: { plan: string | null } }`: descarta tarjetas que no están en `CARDS` y pone `plan: null` si el plan no existe. Cualquier entrada que no sea objeto = `{}`.
  - `applies(cards, ref) → boolean`: `ref` es `{ cardId, plan } | null`. `true` si `cards[ref.cardId]` existe y (`ref.plan === null` o `ref.plan === cards[ref.cardId].plan`).
  - `migrateCards(s, cardOf) → cards | null`: `null` si `s.cards` ya existe o no hay `selectedPromoIds`. Si dos promos elegidas del mismo banco tienen planes distintos, gana el plan de la de mayor `percent`.
  - `bank-rules/coto.js`: `cardOf(promo) → { cardId, plan } | null` sobre la promo ya parseada por `banks.js` (`logo`, `text`). `cardId` sale del nombre del logo (misma limpieza que `bankName` en `banks.js`: exportar esa función como `bankKey`). Plan: `/plan sueldo/i` → `sueldo`; `/identit[eé]/i` → `identite`; con `cardId === "naranjax"`, sobre `text` + la observación: `/[eé]pico/i`, `/turbo/i`, `/inicial/i`. Sin coincidencia: `plan: null`. `parsePromos` suma el campo `obs` (la observación) para esto.
  - Puente: `selected` = promos de Coto con `applies(cleanCards(s.cards), cardOf(p))`; Comunidad sigue con su ajuste. Si `migrateCards` devuelve algo, el puente lo guarda una vez con `storage.set({ cards })`. El mensaje `settings` suma `cards` (ya limpio). `KEYS` suma `"cards"` y `"storesOff"`.

- [ ] **Step 1: Tests que fallan.**

```js
// tests/cards.test.js
expect(applies({ icbc: { plan: "sueldo" } }, { cardId: "icbc", plan: null })).toBe(true);
expect(applies({ icbc: { plan: null } }, { cardId: "icbc", plan: "sueldo" })).toBe(false);
expect(applies({}, { cardId: "icbc", plan: null })).toBe(false);
expect(applies({ icbc: { plan: null } }, null)).toBe(false);
expect(cleanCards({ icbc: { plan: "noexiste" }, inventado: { plan: null }, tci: 7 })).toEqual({ icbc: { plan: null } });
expect(cleanCards("roto")).toEqual({});
// tests/bank-rules-coto.test.js, con parsePromos(PROMOS_RESULT) de tests/fixtures/promos.js
expect(cardOf(byId("457"))).toEqual({ cardId: "icbc", plan: "sueldo" });
expect(cardOf(byId("456"))).toEqual({ cardId: "icbc", plan: null });
expect(cardOf(byId("475"))).toEqual({ cardId: "naranjax", plan: "turbo" });
expect(cardOf(byId("465"))).toEqual({ cardId: "supervielle", plan: "identite" });
// migración
expect(migrateCards({ selectedPromoIds: ["457", "445"], promos }, cardOf)).toEqual({ icbc: { plan: "sueldo" }, columbia: { plan: null } });
expect(migrateCards({ selectedPromoIds: ["457"], promos, cards: {} }, cardOf)).toBe(null);
// tests/bridge.test.js: con cards { icbc: { plan: null } } el mensaje trae selected = [promo 456] y no la 457
```

- [ ] **Step 2: Verlos fallar.** Run: `npx vitest run tests/cards.test.js tests/bank-rules-coto.test.js tests/bridge.test.js`. Expected: FAIL.
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Todo en verde.** Run: `npm test`. Los tests viejos del puente que usan `selectedPromoIds` siguen pasando gracias a la migración.
- [ ] **Step 5: Commit.** `git commit -m "feat: tarjetas y planes en un solo lugar"`

---

### Task 4: Pestaña Tarjetas en una sola lista

**Files:**
- Create: `src/popup-cards.js`
- Modify: `src/popup.js` (saca `cardsView`, `bankLogo` y `describe`; exporta `el`, `icon`, `switchInput`, `norm`, `plural` desde un `src/popup-dom.js` nuevo que usan los dos), `src/popup.css`
- Test: `tests/popup-cards.test.js` (nuevo); mover a ese archivo los tests de Tarjetas que hoy están en `tests/bridge.test.js`

**Interfaces:**
- Consumes: `CARDS`, `cleanCards`, `applies` (Tarea 3); `cardOf` de `bank-rules/coto.js`.
- Produces: `cardsView(doc, s, storage, meta) → Node[]`. `meta.storePromos` (opcional, lo llena la Tarea 8): `{ [storeId]: [{ promo, ref, status }] | "error" }`. `meta.stores`: `Store[]` prendidos.

Comportamiento:
- Día de compra y buscador: igual que hoy.
- Una fila por tarjeta de `CARDS` que tenga al menos una promo en Coto o en `meta.storePromos` (`<details class="bank" data-card="<id>">`). Interruptor = está en `cards`. Prendidas primero, después por nombre.
- Tarjeta prendida con planes: chips de radio "General" (`plan: null`) y uno por plan. Elegir guarda `cards`.
- Debajo, una línea por súper (`.card-store[data-store]`): Coto primero, después `meta.stores`. Texto: `Coto · Miércoles · 25% · tope $9.500` con las promos que aplican al plan elegido; "sin promo online" si no hay ninguna. Para promos con `status !== "ok"`: `unclear` → "sin número claro", `changed` → "los términos cambiaron", y un enlace `Ver en <súper>` a `store.promosUrl` (`target="_blank"`, `rel="noopener"`).
- Al final, si hay promos `unmapped`: un bloque "Otras promos" con título, súper y enlace. No tienen interruptor.
- Resumen: "N tarjetas elegidas" / "Marcá tus tarjetas".

- [ ] **Step 1: Tests que fallan** (jsdom, storage falso como en `tests/bridge.test.js`):

```js
// prender ICBC guarda { cards: { icbc: { plan: null } } }
// elegir el chip "Plan Sueldo" guarda { cards: { icbc: { plan: "sueldo" } } }
// con cards { naranjax: { plan: "turbo" } } la línea de Coto dice "25%" y "tope $9.500" y no "30%"
// con cards { naranjax: { plan: null } } la línea de Coto dice "sin promo online"
// con meta.storePromos.dia = [{ promo: { title: "20% - MODO", percent: null, ... }, ref: { cardId: "modo", plan: null }, status: "unclear" }]
//   la tarjeta MODO muestra "sin número claro" y un <a href="https://diaonline.supermercadosdia.com.ar/medios-de-pago-y-promociones">
// una promo con status "unmapped" aparece bajo "Otras promos"
// buscar "naranja" esconde las demás tarjetas
```

- [ ] **Step 2: Verlos fallar.** Run: `npx vitest run tests/popup-cards.test.js`. Expected: FAIL (módulo inexistente).
- [ ] **Step 3: Implementar** y dar estilo a `.plans`, `.card-store` y "Otras promos" en `src/popup.css` con las variables que ya existen.
- [ ] **Step 4: Todo en verde.** Run: `npm test`.
- [ ] **Step 5: Commit.** `git commit -m "feat: Tarjetas en una sola lista con plan"`

---

### Task 5: Parser de promos de Más

**Files:**
- Create: `src/bank-promos/mas.js`
- Test: `tests/bank-promos-mas.test.js`

**Interfaces:**
- Produces: `parseMas({ promos, banks }) → Promo[]`. `bankLabel` = nombre del banco por `idBank`. `online` = `ecommerce` verdadero (acepta `true` o `"true"`). `days` desde `monday`…`sunday` (0 = domingo). `direct` = `discount_text_info` contiene "descuento". `cap`: de `sub_title`, con `/tope[^$\d]{0,40}\$?\s*(\d{1,3}(?:\.\d{3})+|\d+)/i`; "SIN TOPE" en `title` o `sub_title` → `null`. `capPeriod`: `semanal` → `week`, `mensual` → `month`, `transacci` → `tx`. `minPurchase`: `/m[ií]nimo de compra:?\s*\$\s*([\d.]+)/i`. `from`/`to` = `active_from`/`active_to`. Fila con `active` falso: se descarta.

- [ ] **Step 1: Tests que fallan**, con filas armadas a mano (valores reales del 2026-11-11):

```js
const banks = [{ id: "b1", name: "NaranjaX" }, { id: "b2", name: "Modo" }];
const row = (o) => ({ id: "1", active: true, ecommerce: false, tuesday: true, idBank: "b1", legal: "", ...o });
const [p] = parseMas({ banks, promos: [row({ title: "Plan Turbo - Con Crédito NaranjaX o débito Visa", sub_title: "Tope: $9.500 semanal. (NX)", discount_percentage: 25, discount_text_info: "de reintegro" })] });
expect(p).toMatchObject({ store: "mas", bankLabel: "NaranjaX", percent: 25, cap: 9500, capPeriod: "week", days: [2], online: false, direct: false });
const [m] = parseMas({ banks, promos: [row({ idBank: "b2", ecommerce: true, wednesday: true, tuesday: false, discount_percentage: 20, sub_title: "Tope: $25.000 mensual por banco. Mínimo de compra: $75.000." })] });
expect(m).toMatchObject({ online: true, cap: 25000, capPeriod: "month", minPurchase: 75000, days: [3] });
expect(parseMas({ banks, promos: [row({ title: "SIN TOPE DE REINTEGRO", discount_percentage: 20 })] })[0].cap).toBe(null);
expect(parseMas({ banks, promos: [row({ discount_percentage: null })] })[0].percent).toBe(null);
expect(parseMas({ banks, promos: [row({ active: false })] })).toEqual([]);
expect(parseMas(null)).toEqual([]);
// humo: parseMas(fixture) no lanza y todas las promos tienen store "mas" e id
```

- [ ] **Step 2: Verlos fallar.** Run: `npx vitest run tests/bank-promos-mas.test.js`. Expected: FAIL.
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Verde.** Run: `npx vitest run tests/bank-promos-mas.test.js`. Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -m "feat: leer promos de banco de Más"`

---

### Task 6: Parser de promos de Día

**Files:**
- Create: `src/bank-promos/dia.js`
- Test: `tests/bank-promos-dia.test.js`

**Interfaces:**
- Produces:
  - `diaCards(html) → object[]`: busca cada `"cards":[` en el HTML, lee el array JSON que empieza ahí (contando corchetes y respetando comillas) y se queda con el array más largo cuyos elementos tienen `terms`. `[]` si no hay.
  - `parseDia(html) → Promo[]`. Por tarjeta: `id` = `__editorItemTitle`; `title` igual; `bankLabel` = primer `associatedBanks[].__editorItemTitle`, o el título; `online` = `availableOn.online === true`; `days` desde `daysToShow` (sin `all`); `legal` = `terms`; `from`/`to` = `null`. `active` falso: se descarta.
  - `percent`: primero `/(\d{1,2})\s*%/` del título. Si no, todos los `(\d{1,2})\s*%\s*(?:\([^)]*\)\s*)?DE\s+(?:REINTEGRO|DESCUENTO|AHORRO)` de `terms`: si hay un único valor, ese; si no, `null`.
  - `cap`: si `terms` dice `<percent>% DE DESCUENTO CON TOPE DE $X`, ese X (así cada plan de Naranja toma su tope). Si no, el primer `/TOPE[^$]{0,80}\$\s*(\d{1,3}(?:\.\d{3})+|\d+)/i`. "SIN TOPE" → `null`. `capPeriod` por `SEMANA` / `MES|MENSUAL` / `TRANSACCI` cerca del tope (120 caracteres).
  - `minPurchase`: `/M[IÍ]NIM[OA] DE COMPRA[^$]{0,30}\$\s*([\d.]+)/i` o `/PAGO M[IÍ]NIMO DE \$\s*([\d.]+)/i`.
  - `direct`: `false`.

- [ ] **Step 1: Tests que fallan**, con un HTML mínimo armado a mano:

```js
const html = (cards) => `<script>{"x":{"cards":[{"image":"a"}]},"y":{"bankTabText":"Ver por banco","cards":${JSON.stringify(cards)}}}</script>`;
const card = (o) => ({ __editorItemTitle: "X", active: true, daysToShow: { monday: true, all: true }, availableOn: { online: true }, associatedBanks: [{ __editorItemTitle: "Banco Columbia" }], terms: "", ...o });
const NX = "(1) PLAN INICIAL: 20% DE DESCUENTO CON TOPE DE $3.000 POR SEMANA. (2) PLAN TURBO: 25% DE DESCUENTO CON TOPE DE $9.500 POR SEMANA. (3) PLAN ÉPICO: 30% DE DESCUENTO CON TOPE DE $12.000 POR SEMANA.";
expect(parseDia(html([card({ __editorItemTitle: "Columbia 20% de reintegro", terms: "20% DE AHORRO EN COMPRAS EN UN PAGO, TOPE DE REINTEGRO $10.000 (DIEZ MIL PESOS) POR TRANSACCION." })]))[0])
  .toMatchObject({ store: "dia", bankLabel: "Banco Columbia", percent: 20, cap: 10000, capPeriod: "tx", days: [1], online: true });
expect(parseDia(html([card({ __editorItemTitle: "Naranja 25%", terms: NX })]))[0]).toMatchObject({ percent: 25, cap: 9500, capPeriod: "week" });
expect(parseDia(html([card({ __editorItemTitle: " Personal Pay", terms: "UN 15% (QUINCE POR CIENTO) DE REINTEGRO, SIN TOPE DE REINTEGRO, CON UN MÍNIMO DE COMPRA DE $20.000." })]))[0]).toMatchObject({ percent: 15, cap: null, minPurchase: 20000 });
expect(parseDia(html([card({ __editorItemTitle: "3CSI TC", terms: "TEM: 0,00% - TNA: 0,00%" })]))[0].percent).toBe(null);
expect(parseDia(html([card({ active: false })]))).toEqual([]);
expect(parseDia("<html></html>")).toEqual([]);
// humo: parseDia(fixture) devuelve más de 5 promos y no lanza
```

- [ ] **Step 2: Verlos fallar.** Run: `npx vitest run tests/bank-promos-dia.test.js`. Expected: FAIL.
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Verde.**
- [ ] **Step 5: Commit.** `git commit -m "feat: leer promos de banco de Día"`

---

### Task 7: Parser de promos de Carrefour

**Files:**
- Create: `src/bank-promos/carrefour.js`
- Test: `tests/bank-promos-carrefour.test.js`

**Interfaces:**
- Produces: `parseCarrefour(html) → Promo[] | null`. `null` = "no se pudieron leer los datos" (distinto de `[]` = no hay promos).

Regla de decisión, según el Step 3 de la Tarea 1:
- **Datos en el HTML:** las filas tienen los mismos campos que Más (`title`, `sub_title`, `discount_percentage`, `discount_text_info`, `active`, `active_from`, `active_to`, `ecommerce`, `monday`…`sunday`, `idBank`, `legal`). Extraer las filas y los bancos del HTML y reusar el mapeo de la Tarea 5: mover ese mapeo a `src/bank-promos/valtech.js` (`mapRow(row, bankName, store) → Promo`) y usarlo desde `mas.js` y `carrefour.js`. En Carrefour el tope también puede estar en el texto corto (`"Tope de devolución $10.000"`): sumar `devoluci[oó]n` al patrón del tope.
- **Sin datos en el HTML:** `parseCarrefour` devuelve siempre `null`. El servicio (Tarea 8) lo pasa a `"error"` y el texto es "No pudimos leer las promos de Carrefour".

- [ ] **Step 1: Tests que fallan.** Siempre: `expect(parseCarrefour("<html></html>")).toBe(null)`. Con datos en el HTML, además: `parseCarrefour(fixture)` devuelve al menos una promo con `store: "carrefour"`, `online: true` y `percent` numérico; y una fila armada a mano con `sub_title: "Descuento aplicado en el acto. Tope de devolución $10.000."` y `discount_text_info: "De descuento"` da `cap: 10000` y `direct: true`.
- [ ] **Step 2: Verlos fallar.** Run: `npx vitest run tests/bank-promos-carrefour.test.js`.
- [ ] **Step 3: Implementar** según la regla.
- [ ] **Step 4: Verde.** Run: `npm test` (los tests de Más siguen pasando si se movió `mapRow`).
- [ ] **Step 5: Commit.** `git commit -m "feat: leer promos de banco de Carrefour"`

---

### Task 8: Reglas a mano, alarma y servicio de promos

**Files:**
- Create: `src/bank-rules/hash.js`, `src/bank-rules/mas.js`, `src/bank-rules/dia.js`, `src/bank-rules/carrefour.js`, `src/bank-rules/index.js`, `src/bank-promos/service.js`
- Modify: `src/background.js`, `src/popup-entry.js`, `src/popup.js`
- Test: `tests/bank-rules.test.js`, `tests/bank-promos-service.test.js`

**Interfaces:**
- Consumes: `Promo`, parsers (Tareas 5 a 7), `CARDS` (Tarea 3), `createPriceCache`.
- Produces:
  - `exclusionText(legal) → string`: parte el legal en oraciones (por `.` seguido de espacio o fin, y por saltos de línea), se queda con las que contienen `EXCLU`, `NO INCLUYE`, `NO APLICA SOBRE` o `NO ACUMULABLE`, las pasa a mayúsculas sin acentos, saca todo lo que no sea letra o espacio, colapsa espacios y las une con `|`.
  - `hashOf(text) → string`: FNV-1a de 32 bits en hexadecimal de 8 caracteres.
  - Cada `bank-rules/<súper>.js`: `cardOf(promo) → { cardId, plan } | null` y `exclusions: [{ hash, source, test(product) → boolean }]`. `product` = `{ name, brand, groups: string[], onSale: boolean }` (nombre y marca de Coto, en minúsculas sin acentos).
  - `bank-rules/index.js`: `RULES = { coto, mas, dia, carrefour }`; `statusOf(promo, rules) → "ok" | "unmapped" | "unclear" | "changed"` en este orden: sin `cardOf` → `unmapped`; `percent === null` → `unclear`; huella de `exclusionText(promo.legal)` fuera de `rules.exclusions` → `changed`; si no `ok`. `excluded(promo, rules, product) → boolean`.
  - `createBankPromosService({ fetch, cache, now, parsers, stores }) → { get(storeIds) → Promise<{ [storeId]: Promo[] | "error" }> }`. Memoria con `createPriceCache(storage, now, { key: "bankPromosCache", ttlMs: 86_400_000, max: 10 })`, una entrada por súper con las promos ya parseadas. Devuelve solo `online`, y con `from`/`to` que contienen `now()` (`null` = sin límite). Parser que devuelve `null` o pedido que falla → `"error"`, y no se guarda.
  - Mensaje `{ type: "bankPromos", stores }` en `background.js`.
  - `popup-entry.js`: pide `bankPromos` para `enabledStores(s)` y pasa `meta.storePromos = { [storeId]: promos.map((promo) => ({ promo, ref: cardOf(promo), status: statusOf(promo, RULES[storeId]) })) }` y `meta.stores`. Primero dibuja sin promos; cuando llegan, vuelve a dibujar.

Cómo escribir las reglas (trabajo de lectura, con las capturas de la Tarea 1):
1. Listar las promos `online` de cada captura. Por cada `bankLabel`, una línea en `cardOf` (expresión regular sobre `bankLabel` + `title`, sin acentos) que devuelve la tarjeta de `CARDS` y el plan. Planes de Naranja X: `inicial`, `turbo`, `epico` por el título. Si un banco no está en `CARDS`, sumarlo a `CARDS`.
2. Por cada `exclusionText` distinto entre esas promos, una entrada en `exclusions` con su `hash`, `source` (URL y fecha de lectura) y un `test` que cubre **cada** rubro y marca del texto, con el estilo de `src/exclusions.js` (grupos de Coto por `group_id`, marcas con límite de palabra). "No acumulable con otras promociones" o "ofertón"/"precio súper bajo" → `product.onSale`. Texto vacío (sin exclusiones) → entrada con `hashOf("")` y `test: () => false`.
3. Si un rubro del texto no se puede traducir a una regla confiable, **no** se agrega esa entrada: la promo queda `changed` y no se resta.

- [ ] **Step 1: Tests que fallan.**

```js
// tests/bank-rules.test.js
const A = "VÁLIDO TODOS LOS JUEVES DE NOVIEMBRE 2026. NO INCLUYE CARNICERÍA, FRUTAS NI VERDURAS. TOPE $10.000.";
const B = "VÁLIDO TODOS LOS JUEVES DE DICIEMBRE 2026. NO INCLUYE CARNICERÍA, FRUTAS NI VERDURAS. TOPE $12.000.";
const C = "VÁLIDO TODOS LOS JUEVES DE NOVIEMBRE 2026. NO INCLUYE CARNICERÍA, FRUTAS, VERDURAS NI LÁCTEOS. TOPE $10.000.";
expect(exclusionText(A)).toBe("NO INCLUYE CARNICERIA FRUTAS NI VERDURAS");
expect(hashOf(exclusionText(A))).toBe(hashOf(exclusionText(B)));
expect(hashOf(exclusionText(A))).not.toBe(hashOf(exclusionText(C)));
expect(exclusionText("")).toBe("");
const rules = { cardOf: (p) => (p.bankLabel === "X" ? { cardId: "modo", plan: null } : null), exclusions: [{ hash: hashOf(exclusionText(A)), test: (pr) => /carne/.test(pr.name) }] };
expect(statusOf({ bankLabel: "Z", percent: 20, legal: A }, rules)).toBe("unmapped");
expect(statusOf({ bankLabel: "X", percent: null, legal: A }, rules)).toBe("unclear");
expect(statusOf({ bankLabel: "X", percent: 20, legal: C }, rules)).toBe("changed");
expect(statusOf({ bankLabel: "X", percent: 20, legal: B }, rules)).toBe("ok");
expect(excluded({ legal: A }, rules, { name: "carne picada", brand: "", groups: [], onSale: false })).toBe(true);
// por súper, con las capturas: toda promo online con percent tiene statusOf === "ok" o "unmapped" documentado en un comentario
// Más: la leche fluida, la Coca-Cola y un corte de carnicería dan excluded === true para la promo MasClub online; un detergente da false
// tests/bank-promos-service.test.js
// get(["mas"]) llama a fetch una vez; una segunda llamada dentro de 24 h no llama a fetch
// una promo con online: false no vuelve; una con to anterior a now() no vuelve
// fetch que falla → { mas: "error" } y la siguiente llamada vuelve a pedir
// parser que devuelve null → "error"
```

- [ ] **Step 2: Verlos fallar.** Run: `npx vitest run tests/bank-rules.test.js tests/bank-promos-service.test.js`. Expected: FAIL.
- [ ] **Step 3: Implementar** `hash.js`, `index.js`, `service.js` y el mensaje en `background.js`.
- [ ] **Step 4: Escribir las reglas** de los tres súper siguiendo los pasos 1 a 3 de arriba.
- [ ] **Step 5: Cablear el popup** (`popup-entry.js`, `renderPopup` acepta `meta.storePromos` y `meta.stores`).
- [ ] **Step 6: Todo en verde.** Run: `npm test`.
- [ ] **Step 7: Commit.** `git commit -m "feat: promos de banco de otros súper con reglas a mano y alarma"`

---

### Task 9: Simular el carrito entero en cada súper

**Files:**
- Modify: `src/vtex.js`, `src/compare-service.js`, `src/background.js`
- Test: `tests/vtex.test.js`, `tests/compare-service.test.js`

**Interfaces:**
- Produces:
  - `cartSimulationRequest(store, items) → { url, init }`: `items` = `[{ hit, qty }]`; cuerpo `{ items: [{ id, quantity, seller }], country: "ARG" }`; misma URL que `simulationRequest`.
  - `parseCartSimulation(json) → Map<itemId, { total, quantity, onSale }>`: solo items con `availability === "available"`. Guarda `quantity` para que el servicio la compare con la pedida. `total` en pesos = `priceDefinition.total / 100` si existe; si no, `sellingPrice * quantity / 100`. `onSale` = `listPrice > sellingPrice`. Se cruza por `id`, nunca por posición.
  - `service.cartCompare(items, storeIds) → { [storeId]: { at: number, lines: { [ean]: { total, onSale, url } | "missing" } } | "error" }`. `items` = `[{ ean, qty }]`, EAN validados con `validEan`, `qty` entero ≥ 1, máximo 200. Por súper: búsqueda en lotes de 50, después **una** simulación con todos los encontrados con stock. `"missing"`: sin resultado, sin stock, no volvió en la simulación, o volvió con otra cantidad. Búsqueda o simulación que falla → `"error"` para ese súper. Sin memoria; los pedidos iguales en vuelo se comparten (clave: súper + lista ordenada de `ean:qty`). Llama a `onStatus` como `compare`.
  - Mensaje `{ type: "cartCompare", items, stores }` en `background.js`.

- [ ] **Step 1: Tests que fallan.**

```js
// tests/vtex.test.js, con tests/fixtures/vtex-cart.json
const sim = parseCartSimulation(fixture.dia.simulation);
// una entrada por item disponible; la suma de los total es igual a la suma de totals[] con id "Items" y "Discounts", con 0,01 de margen
expect(parseCartSimulation({ items: [{ id: "9", quantity: 2, availability: "available", sellingPrice: 150000, listPrice: 200000 }] }).get("9")).toEqual({ total: 3000, quantity: 2, onSale: true });
expect(parseCartSimulation({ items: [{ id: "9", quantity: 1, availability: "withoutStock", sellingPrice: 100 }] }).size).toBe(0);
expect(parseCartSimulation(null).size).toBe(0);
// tests/compare-service.test.js
// cartCompare([{ ean: A, qty: 2 }, { ean: B, qty: 1 }], ["dia"]): 1 búsqueda + 1 simulación a Día, ninguna a otro host
// la simulación devuelve los items en orden inverso → cada EAN recibe su propio total
// la simulación devuelve solo A → B es "missing"
// 120 EAN → 3 búsquedas y 1 simulación
// simulación con HTTP 500 → { dia: "error" }
// qty 0, qty 1.5 o EAN inválido → ese item se descarta
```

- [ ] **Step 2: Verlos fallar.** Run: `npx vitest run tests/vtex.test.js tests/compare-service.test.js`. Expected: FAIL.
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Verde.** Run: `npm test`.
- [ ] **Step 5: Commit.** `git commit -m "feat: simular el carrito entero en cada súper"`

---

### Task 10: La cuenta del carrito comparado

**Files:**
- Create: `src/cart-compare.js`
- Modify: `src/cart.js` (cada línea del análisis suma `bankEligible: boolean`, `brand: string`, `groups: string[]`, tomados de `data.product_brand` y `data.groups[].group_id`)
- Test: `tests/cart-compare.test.js`, `tests/cart.test.js`

**Interfaces:**
- Consumes: análisis de `analyzeCart` (líneas con `ean`, `cmp`, `qty`, `total`, `name`, `bankEligible`, `brand`, `groups`; `a.today?.promo` con `percent` y `cap`); resultado de `cartCompare` (Tarea 9); `{ [storeId]: Promo[] | "error" }`; `cards`; `RULES`, `statusOf`, `excluded`, `applies` (Tareas 3 y 8).
- Produces: `compareCart({ analysis, results, promos, cards, day, stores, rules }) → { stores: StoreCmp[], verdict }`.

```js
// StoreCmp
{ id, name, state: "ok" | "error" | "empty",       // empty = ningún producto en común
  at,                                               // de cartCompare
  matched: number, of: number,                      // "9 de 12"
  common: [{ ean, name, coto, other, url }], missing: [{ ean, name }],
  coto: number, other: number, diff: number,        // sin banco; diff = other - coto
  bankCoto: { label, saving, total } | null,
  bankOther: { label, saving, total } | null,
  bankNote: null | "none" | "min" | "changed" | "error", minLeft: number | null }
// verdict
{ winner: "coto" | storeId, saving: number, withCards: boolean } | { winner: null }
```

Reglas:
- `of` = líneas del carrito con `qty > 0`. Línea faltante: sin `ean`, sin `cmp`, resultado `"missing"`, o `other / qty` fuera de `[0.4, 2.5]` × `total / qty` de Coto.
- `coto` = suma de `line.total` de las comunes; `other` = suma de los `total` del súper. Redondeo a 2 decimales.
- `bankCoto`: con `analysis.today?.promo`: `saving = min(elegible × percent / 100, cap ?? Infinity)`, `elegible` = comunes con `bankEligible`. `label` = `"<banco> <percent>%"`.
- `bankOther`: entre las promos del súper con `statusOf === "ok"`, `days` que incluye `day` y `applies(cards, cardOf(promo))`, la de mayor `saving`. `elegible` = comunes sin `excluded(promo, rules, { name, brand, groups, onSale })`. Si `other < minPurchase`, esa promo no aplica.
- `bankNote` cuando `bankOther` es `null`: `"error"` si las promos del súper son `"error"`; `"min"` (y `minLeft`) si la única razón es la compra mínima; `"changed"` si hay una promo de sus tarjetas ese día con estado `changed`; si no `"none"`.
- `verdict`: compiten Coto y los súper `ok` con `coto ≥ 0.5 × analysis.total`. `withCards` = `Object.keys(cards).length > 0`. Total de cada súper = `bankOther?.total ?? other`; el de Coto, para ese mismo súper = `bankCoto?.total ?? coto` (sin tarjetas: `other` y `coto`). Gana el súper con mayor `totalCoto − totalOtro` si supera el 1% de `totalCoto`; si ninguno lo supera, gana `"coto"` con `saving` = la menor diferencia a favor de Coto (0 si empatan). Sin súper que compitan: `{ winner: null }`.

- [ ] **Step 1: Tests que fallan.** Armar un `analysis` de 4 líneas a mano (totales 1000, 2000, 3000, 4000; la última sin `ean`) y `results` para `dia`:

```js
// faltantes: sin ean, "missing", y dato dudoso (other 100 contra coto 1000) → matched 1 de 4
// sin banco: comunes 1000 + 2000 + 3000 en Coto, 900 + 1900 + 2800 en Día → coto 6000, other 5600, diff -400
// bankCoto: today.promo { bank: "ICBC", percent: 20, cap: 500 }, una línea común con bankEligible false (3000) → saving min(600, 500) = 500, total 5500
// bankOther: promo ok 25% tope 9500 martes, cards { naranjax: { plan: "turbo" } }, day 2 → saving 1400, total 4200
// la misma promo con day 3 → bankOther null, bankNote "none"
// promo con minPurchase 75000 → bankOther null, bankNote "min", minLeft 69400
// promo de su tarjeta con estado changed → bankNote "changed"
// promos "error" → bankNote "error" y el veredicto usa other sin banco para ese súper
// una línea excluida por las reglas no entra en elegible
// verdict: Día gana por 1300 con tarjetas; con cards {} compara sin banco y Día gana por 400
// verdict: diferencia de 0,5% → winner "coto"
// verdict: súper con coto < 50% del total del carrito no compite → { winner: null } si era el único
// results.dia === "error" → state "error" y no compite; sin productos en común → state "empty"
// tests/cart.test.js: las líneas traen bankEligible, brand y groups
```

- [ ] **Step 2: Verlos fallar.** Run: `npx vitest run tests/cart-compare.test.js tests/cart.test.js`. Expected: FAIL.
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Verde.** Run: `npm test`.
- [ ] **Step 5: Commit.** `git commit -m "feat: cuenta del carrito comparado con y sin banco"`

---

### Task 11: Pintar el carrito comparado

**Files:**
- Create: `src/cart-compare-ui.js`
- Modify: `src/cart-ui.js`, `src/badge-entry.js`, `src/badge.css`
- Test: `tests/cart-compare-ui.test.js`, `tests/cart-ui.test.js`

**Interfaces:**
- Consumes: `compareCart` (Tarea 10), `$0` y `$2`, `STORES`, mensajes `cartCompare` y `bankPromos`.
- Produces:
  - `paintCartCompare(doc, box, cmp, { now, onRefresh }) → void`: pinta dentro de `box` (clase `coto-unit-cc`). Idempotente: si lo que hay que pintar no cambió, no toca el DOM (misma técnica de firma que `paintSummary`). Recuerda en `box.dataset.open` qué listas de faltantes están abiertas.
  - `miniCartLine(cmp) → string | null`.
  - `installCartUi` acepta `deps.cartCompare(items, stores) → Promise` y `deps.bankPromos(stores) → Promise`. `badge-entry.js` los arma con `chrome.runtime.sendMessage`, con `.catch(() => null)`.

Textos exactos:
- Título: "Tu carrito en otros súper".
- Respuesta: `winner: "coto"` → "Hoy te conviene Coto"; otro → "Hoy te conviene <súper>". Debajo: "Con tus tarjetas pagás $X menos que en <el segundo>" o, sin tarjetas, "Pagás $X menos". Con `saving` 0: "Sale casi lo mismo en todos". `winner: null` → "Pocos productos en común para comparar".
- Por súper: "<súper> · 9 de 12 productos"; ▼ "$3.150 menos" (clase `coto-unit-cc--down`), ▲ "$1.200 más" (`--up`), "= casi igual" dentro del 1%.
- Renglón "Sin banco": "$33.900 · Coto $37.050".
- Renglón con tarjetas: "Con tus tarjetas (<label>)": "$25.425 · Coto $23.025". Si `bankOther` es `null`: `none` → "Sin promo de tus tarjetas hoy"; `min` → "Te faltan $X para la compra mínima"; `changed` → "Los términos cambiaron: no se resta"; `error` → "No pudimos leer las promos". Sin tarjetas prendidas, el renglón no va.
- "Faltan 3: ver cuáles" (botón) abre la lista de `missing`. "Ver los 9 productos" abre `common`, cada uno con "Ver en <súper>" (`url`, `target="_blank"`, `rel="noopener"`).
- `state: "error"` → "No pudimos consultar <súper>". `state: "empty"` → "<súper>: ningún producto en común".
- Pie: "Precios online de hace N min, sin envío" (N desde el `at` más viejo; menos de 1 min = "recién") y el botón "Actualizar".
- Mini-carrito (`miniCartLine`): "<súper>: $3.150 menos en 9 de 12" si gana otro súper; "Coto es el más barato" si gana Coto; `null` si `winner` es `null`.

Cableado en `cart-ui.js`:
- Estado nuevo: `stores`, `cards` (del mensaje `settings`), `cc` (último resultado de `cartCompare` con su firma), `promos`.
- Firma del carrito = lista ordenada de `ean:qty` + súper prendidos. Cuando cambia, espera 800 ms sin cambios y pide `cartCompare` y `bankPromos`. Una respuesta con firma vieja se descarta. "Actualizar" pide de nuevo ya.
- En `/carrito`: el bloque va después de la caja de resumen (`BOX`). En el mini-carrito: la línea va dentro de la caja de resumen existente, como una fila más, sin cambiar su alto fijo; un clic lleva a `/carrito`.
- No se pinta si `state.compare` es falso, si no hay súper prendidos, si el carrito no tiene ninguna línea con `ean` o si `inSync` falla. Al apagar un súper, su bloque desaparece en el repintado siguiente aunque su respuesta llegue después.

- [ ] **Step 1: Tests que fallan** (jsdom):

```js
// paintCartCompare con un cmp donde gana Día: el texto contiene "Hoy te conviene Día", "9 de 12 productos", "$3.150 menos"
// bankNote "min" con minLeft 69400 → "Te faltan $69.400 para la compra mínima"
// clic en "Faltan 3: ver cuáles" muestra los 3 nombres; un segundo paintCartCompare con el mismo cmp los deja abiertos
// state "error" → "No pudimos consultar Día"
// dos llamadas seguidas con el mismo cmp no cambian los nodos (mismo firstChild)
// clic en "Actualizar" llama a onRefresh una vez
// miniCartLine: los tres casos
// tests/cart-ui.test.js, con timers falsos:
//   dos mensajes "cart" seguidos → un solo deps.cartCompare después de 800 ms
//   la respuesta de un carrito viejo no se pinta
//   settings con stores: [] → no se llama a deps.cartCompare y no existe .coto-unit-cc
//   settings que saca "dia" con una respuesta en vuelo → al llegar, no hay bloque de Día
//   ningún nodo de Coto del fixture cambia de padre ni de atributos
```

- [ ] **Step 2: Verlos fallar.** Run: `npx vitest run tests/cart-compare-ui.test.js tests/cart-ui.test.js`. Expected: FAIL.
- [ ] **Step 3: Implementar** y dar estilo en `src/badge.css` (bloque `.coto-unit-cc`): reusar las variables y los colores de `.coto-unit-cmp` y de la caja de resumen; números con `tabular-nums`.
- [ ] **Step 4: Verde.** Run: `npm test` y `npm run build`. Expected: PASS y build sin errores.
- [ ] **Step 5: Commit.** `git commit -m "feat: carrito comparado en /carrito y en el mini-carrito"`

---

### Task 12: Textos, privacidad, versión y prueba manual

**Files:**
- Modify: `src/popup.js` (Ayuda), `PRODUCT.md`, `site/privacidad.html`, `docs/chrome-web-store.md`, `README.md`, `README.en.md`, `manifest.json`, `package.json`, `package-lock.json`
- Test: `tests/bridge.test.js` (bloque `popup`), `tests/package.test.js`

- [ ] **Step 1: Test que falla.** La pestaña Ayuda contiene "Las promos de otros súper son solo de compra online. Los totales no incluyen envío. Si los términos de una promo cambiaron, no se resta." y ya no contiene "Sin descuentos bancarios".
- [ ] **Step 2: Implementar los textos.** En `PRODUCT.md` (Positioning y Capabilities), `site/privacidad.html` y `docs/chrome-web-store.md`: además de códigos de barras, se mandan las cantidades del carrito a Carrefour, Día y Más para simular la compra, y se leen sus páginas públicas de promos; sin cookies, sin datos personales. README en los dos idiomas: una línea por función nueva (elegir súper, carrito comparado, tarjetas para todos los súper).
- [ ] **Step 3: Versión `0.15.0`** en `manifest.json`, `package.json` y `package-lock.json`.
- [ ] **Step 4: Verde.** Run: `npm test` y `npm run build`.
- [ ] **Step 5: Prueba manual.** Cargar la extensión desde `D:\Trabajo\Personal\Otros\coto-precio-por-unidad` (la carpeta principal, después de traer la rama) y revisar en coto.com.ar: (a) apagar Más en Ajustes saca a Más de la lista, de la ficha y del carrito; (b) prender Naranja X con plan Turbo muestra sus líneas por súper; (c) un carrito de 5 productos muestra el bloque, "Faltan N" abre la lista y "Actualizar" vuelve a pedir; (d) el mini-carrito no cambia de tamaño; (e) agregar, cambiar cantidades y pagar en Coto funcionan igual. Anotar en el PR lo que no se pudo probar.
- [ ] **Step 6: Commit.** `git commit -m "chore: textos, privacidad y versión 0.15.0"`
