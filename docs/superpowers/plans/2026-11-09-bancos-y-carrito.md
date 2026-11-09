# Bancos, promos por cantidad y carrito — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Bank promo per chosen day, multi-buy labels, offers page sort, product-page and carousel labels, and a cart analysis box on coto.com.ar.

**Architecture:** Same split as v1. MAIN world (`interceptor.js`) owns data: API interception, bank promos, cart lookups, calculations. Isolated world owns storage and DOM: `bridge.js` (storage ↔ page), `badge.js` (labels), `cart-ui.js` (cart). Popup edits settings in `chrome.storage.local`.

**Tech Stack:** JS ES modules, esbuild, Vitest + jsdom.

**Spec:** `docs/superpowers/specs/2026-11-09-bancos-y-carrito-design.md`

## Global Constraints

- All messages carry `source: "coto-unit"`. Types and payloads exactly as the spec table.
- Label shape: `{ group, value, drained, take, bankValue, bankName }` (`take` ≥ 1; `bankValue`/`bankName` null when no promo applies).
- Day numbers 0–6, 0 = domingo. Coto `dias[].id − 1`.
- Settings wait: 500 ms max. Cart PLU cache: 5 min.
- Copy, verbatim (`<n>` = es-AR, no decimals):
  - `$<n>/<u> final`, `$<n>/<u> llevando <N>`, `$<n>/<u> escurrido`
  - `<Día> con <Banco>: $<n>/<u>`, with `<Día>` = `Hoy` when the chosen day is today, else `Domingo`…`Sábado`
  - `⚠ Agregá <k> más y se activa el <promo>: ahorrás $<n>` (`<promo>` = `discountText`)
  - `Total con promos de Coto: $<n>` / `<Día> con <Banco>: $<n> (reintegro $<n>)` / `Mejor día: <día en minúscula> con <Banco>, $<n>` / `El tope de <Banco> es semanal.`
  - Popup empty state: `Abrí coto.com.ar una vez para cargar las promos`
- Never modify Coto's cart response or DOM nodes; only add nodes.
- Remove `host_permissions`; add `"permissions": ["storage"]`.

## Review Focus

1. Promo whose `observacion` has two caps (Comafi "$ 15.000 … $ 25.000") → use the first (conservative). Test in Task 1.
2. Product on sale + bank promo `onlyNoOffer` → no bank line, sort uses `value`. Test in Task 2.
3. Cart quantity above N but not multiple (4 Dove with 3x2) → 3 at promo + 1 at list, `faltan = 2`. Test in Task 3.
4. Settings arrive after the first product response (slow storage) → first response waits ≤ 500 ms then proceeds without bank. Test in Task 4.
5. Cart line name differs in case/accents/spaces from `producto.nombre` → still matched. Test in Task 7.

---

### Task 1: `src/banks.js`

**Files:** Create `src/banks.js`, `tests/fixtures/promos.js`, Test `tests/banks.test.js`.
**Produces:**
- `parsePromos(result) → Promo[]` where `Promo = { id, bank, logo, days: number[], percent, cap: number|null, capWeekly: boolean, onlyNoOffer: boolean, text }` (only `DESCUENTO` promos).
- `bestPromo(promos: Promo[], day: number, onSale: boolean) → Promo|null`.
- `dayName(day) → "Domingo"…"Sábado"`.

- [ ] Fixture: the 14 real digital % promos (id, banco, icono, dias ids, textoDescuento, descripcion, observacion) + 1 cuotas promo.
- [ ] Tests: 14 parsed (cuotas dropped); ICBC 457 → `{bank:"ICBC", days:[1], percent:30, cap:20000, capWeekly:false}`; Credicoop 449 cap null; Ciudad 440 `onlyNoOffer:true`, cap 30000; Comafi 447 cap 15000; Naranja 477 `capWeekly:true` cap 12000; Comunidad 468 cap null; `bestPromo` Tuesday → Comafi 35; Tuesday onSale with only Ciudad selected on Monday → null.
- [ ] Run → FAIL; implement; run → PASS; commit `feat: parse Coto bank promos`.

### Task 2: unit price with `take` and bank

**Files:** Modify `src/unit-price.js`, `src/sort.js`; tests in `tests/unit-price.test.js`, `tests/sort.test.js`.
**Produces:**
- `takeQty(data) → number` from `/Llevando (\d+)/` in any `discounts[].takingText` that matches the chosen discount; default 1. Use the discount whose `discountPrice` produced `finalPrice`.
- `isOnSale(data) → boolean` (`discounts.length > 0`).
- `unitPrice(data, store, promos = [], day = 0)` adds `take`, `bankValue`, `bankName`.
- `sortByUnitPrice(results, store, promos = [], day = 0)` sorts by `bankValue ?? value`; returns `{ results, labels, marks }` with `marks` = key → group for group starts (labels no longer carry `groupStart`).

- [ ] Tests: COTO leche 3x2 row → `take: 3`; Listerine 35% → `take: 1`; ICBC 30% Monday on a non-sale item → `bankValue = value × 0.7`; Ciudad (onlyNoOffer) on a sale item → `bankValue: null`; sort order uses bankValue (an onlyNoOffer promo can flip two items); existing tests updated for `marks`.
- [ ] FAIL → implement → PASS → commit `feat: multi-buy quantity and bank price in unit price`.

### Task 3: `src/cart.js`

**Files:** Create `src/cart.js`, `tests/fixtures/cart.js`, Test `tests/cart.test.js`.
**Produces:** `analyzeCart(lines, promos, day, store) → { lines: [{ id, name, missing, saving, promoText }], total, today: { promo, refund, total }|null, best: { day, promo, refund, total }|null, weeklyCapBanks: string[] }` where `lines` input = `[{ id, name, qty, list, data }]` (`data` = search API product data or null).

- [ ] Fixture: real cart (6 items) + search rows.
- [ ] Tests: `total` = 37453.81 (±0.01); Dove line qty 3 → missing 0; qty 4 → line total `3×1826.08 + 2738.99`, missing 2, saving `3 × (2738.99 − 1826.08)`; item with `data: null` → list price; ICBC Monday 30% cap 20000 → refund `min(0.3×37453.81, 20000)` = 11236.14; Ciudad onlyNoOffer → eligible excludes Listerine, Dove, Tresemmé; best day picks highest refund, tie → chosen day; Naranja chosen → `weeklyCapBanks: ["Naranja X"]`.
- [ ] FAIL → implement → PASS → commit `feat: cart analysis with promos and bank refund`.

### Task 4: interceptor extensions

**Files:** Modify `src/interceptor.js`, `src/response.js`, `src/main.js`; tests in `tests/interceptor.test.js`, `tests/response.test.js`.
**Produces:** `installInterceptor(win, deps)` with `deps` adding `listen(fn)` (subscribe to page messages) and `promosUrl`. Behavior per spec "Mundo de la página".

- [ ] Tests: offers URL → unit option + sort works; recommendations URL → untouched body, posts `labels` with `marks: null`; on install posts `promos`; settings message changes `bankValue` in posted labels; no settings → response delivered after ~500 ms (fake timers) without bank; getCarrito response → untouched, posts `cart` with total; `lookup` message → posts labels for that key; labels message now `{ labels, marks, seq }`.
- [ ] FAIL → implement → PASS → commit `feat: interceptor handles offers, carousels, banks, cart and lookups`.

### Task 5: badge v2

**Files:** Modify `src/badge.js`; tests `tests/badge.test.js`.

- [ ] Tests: labels merge across messages and show without unit sort; `take: 3` → `$1.666/L llevando 3`; bank line `Hoy con ICBC: $3.624/kg` (fake clock day); marks from latest seq only, `marks:null` clears marks; on a product URL posts `lookup` with PLU `217832` and key, label goes after first `.price`.
- [ ] FAIL → implement → PASS → commit `feat: always-on labels with bank line and product page`.

### Task 6: bridge + popup

**Files:** Create `src/bridge.js`, `popup.html`, `src/popup.js`, `src/popup.css`; tests `tests/bridge.test.js`, `tests/popup.test.js` (fake `chrome.storage.local` with get/set/onChanged).

- [ ] Tests: `promos` message saved with `fetchedAt`; on start posts `settings` with selected promo objects and resolved day (`"hoy"` → today); storage change re-posts; popup renders grouped checkboxes, saving toggles `selectedPromoIds`, day select saves; empty state text.
- [ ] FAIL → implement → PASS → commit `feat: settings bridge and popup`.

### Task 7: cart UI

**Files:** Create `src/cart-ui.js`; test `tests/cart-ui.test.js`.

- [ ] Tests: on `/carrito`, `cart` message adds warning to the matching `card-product` (name match ignoring case/accents/spaces); box inserted after `.card-body-container` with the verbatim lines; second message replaces, not duplicates; non-cart path does nothing.
- [ ] FAIL → implement → PASS → commit `feat: cart warnings and real total box`.

### Task 8: manifest, build, live check

- [ ] Manifest: storage permission, action popup, isolated scripts `dist/badge.js` (bundles badge + bridge + cart-ui) at `document_start`; remove host_permissions. Build entries updated.
- [ ] `npm run build` → 2 bundles + popup bundle.
- [ ] Live (injected bundles + simulated settings): offers page sort; product page label; cart box numbers match `analyzeCart`; Coto's own total untouched.
- [ ] Commit `feat: wire v2 extension`.
