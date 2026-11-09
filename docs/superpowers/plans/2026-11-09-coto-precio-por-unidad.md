# Coto precio por unidad — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chrome extension (MV3) that adds "Precio por kg/L: menor a mayor" to the native "Ordenar por" menu on coto.com.ar, ordering by final price per unit while every native Coto feature keeps working.

**Architecture:** A MAIN-world script patches `XMLHttpRequest` before Angular loads. It injects a sort option into the API response, and for `sort_by=unit_price` fetches all pages, sorts with pure functions, and hands Angular the requested page slice. An isolated content script adds price badges to the native cards.

**Tech Stack:** Plain JavaScript ES modules, esbuild (bundle to `dist/`), Vitest + jsdom, Node 20+.

**Spec:** `docs/superpowers/specs/2026-11-09-coto-precio-por-unidad-design.md`

## Global Constraints

- Manifest V3. Matches `https://www.coto.com.ar/*`. No extra permissions beyond `host_permissions` for `https://api.coto.com.ar/*`.
- API base: `https://api.coto.com.ar/api/v1/ms-digital-sitio-bff-web/api/v1/products/`; intercepted paths contain `/products/categories/` or `/products/search/`.
- `num_results_per_page` max is `200`. Product cap is `1000`. Cache TTL is `5` minutes.
- New sort option, verbatim: `{ sort_by: "unit_price", sort_order: "ascending", display_name: "Precio por kg/L: menor a mayor", hidden: false }`.
- The rewritten request uses `sort_by=price&sort_order=ascending`.
- Store id = the `us` query param of the request (`URLSearchParams.get("us")`).
- Copy, verbatim: badge `$<n>/kg final`, `$<n>/L final`, `$<n>/unidad final`; drained `$<n>/kg escurrido`, `$<n>/L escurrido`; group marks `▸ Por kilo`, `▸ Por litro`, `▸ Por unidad`; notices `No se pudo ordenar por precio por kg` and `Se ordenaron los primeros 1.000 productos`. `<n>` = `Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 })`.
- Golden rule: on any failure, Angular receives Coto's original response untouched (or, for a failed page fetch, the original response plus the notice).
- Never remove or move Coto DOM nodes; only append.

## Review Focus

1. `discounts_payment_methods` with `cantidadCuotas` > 1 → `precioCuota` is one installment and must be ignored (else 6-cuota items jump to the top). Test in Task 1.
2. Money text in either `"$2588.72"` or `"$2.588,72"` format → both parse to `2588.72`. Test in Task 1.
3. Landing directly on `...?sort_by=unit_price&page=3` (reload/shared link) → first intercepted request is page 3; fetch all, return slice 3. Test in Task 4.
4. Switching filters (brand, offers) while on unit_price → different cache key, no stale list. Test in Task 3 (`cacheKey` keeps filter params).
5. Switching back to a native sort → menu shows native option selected, badges disappear. Test in Task 4 (posts `active:false`) and Task 5 (clears badges).

---

## File Structure

```
package.json            scripts: test, build, fixtures
manifest.json
build.mjs               esbuild: src/main.js → dist/interceptor.js, src/badge.js → dist/badge.js
scripts/capture-fixtures.mjs
src/money.js            parseMoney
src/unit-price.js       normalizeUnit, pickStorePrice, finalPrice, unitPrice
src/sort.js             sortByUnitPrice
src/response.js         pure helpers on URLs and API JSON
src/interceptor.js      installInterceptor (XHR patch)
src/main.js             entry: installInterceptor(window, real deps)
src/badge.js            badges + notice (isolated world)
src/badge.css
tests/fixtures/*.json
tests/*.test.js
```

---

### Task 1: Scaffold, fixtures, unit price calculator

**Files:**
- Create: `package.json`, `scripts/capture-fixtures.mjs`, `src/money.js`, `src/unit-price.js`
- Create: `tests/fixtures/pastas-rellenas.json`, `tests/fixtures/aceite.json`, `tests/fixtures/busqueda-mixta.json`
- Test: `tests/unit-price.test.js`

**Interfaces:**
- Produces:
  - `parseMoney(text: string|number|null): number|null`
  - `normalizeUnit(format: string|undefined, qty: number|undefined): { group: "kg"|"L"|"unidad"|"sin_dato", factor: number, drained: boolean }`
  - `pickStorePrice(data, store: string): { listPrice: number, formatPrice: number } | null`
  - `finalPrice(data, store: string): number|null`
  - `unitPrice(data, store: string): { group, value: number|null, drained: boolean }`

- [ ] **Step 1: Scaffold**

`npm init -y`, set `"type": "module"`, install dev deps `vitest jsdom esbuild`. Scripts: `"test": "vitest run"`, `"build": "node build.mjs"`, `"fixtures": "node scripts/capture-fixtures.mjs"`.

- [ ] **Step 2: Capture fixtures**

`scripts/capture-fixtures.mjs` GETs these URLs (common query: `key=key_r6xzz4IAoTWcipni&pre_filter_expression=%7B%22name%22:%22store_availability%22,%22value%22:%22200%22%7D&c=cio-fe-web-coto-4.6.0&us=200&num_results_per_page=200&page=1`) and writes the raw JSON:
- `categories/catv00001869` → `tests/fixtures/pastas-rellenas.json`
- `search/aceite` → `tests/fixtures/aceite.json`
- `search/busqueda` → `tests/fixtures/busqueda-mixta.json`

Run: `npm run fixtures`. Expected: 3 files; `pastas-rellenas.json` has `response.results.length === 79` (± catalog drift), `aceite.json` has 200 results.

- [ ] **Step 3: Write failing tests** in `tests/unit-price.test.js`

```js
expect(parseMoney("$2588.72")).toBe(2588.72);
expect(parseMoney("$2.588,72")).toBe(2588.72);
expect(parseMoney("$12.099")).toBe(12099);
expect(parseMoney("abc")).toBeNull();
expect(parseMoney(3459)).toBe(3459);

expect(normalizeUnit("Kilo", 1)).toEqual({ group: "kg", factor: 1, drained: false });
expect(normalizeUnit("Kilogramo", 1).group).toBe("kg");
expect(normalizeUnit("Kilo escurrido", 1)).toEqual({ group: "kg", factor: 1, drained: true });
expect(normalizeUnit("Gramos", 100)).toEqual({ group: "kg", factor: 10, drained: false });
expect(normalizeUnit("Litro escurrido", 1)).toEqual({ group: "L", factor: 1, drained: true });
expect(normalizeUnit("Mililitros", 100)).toEqual({ group: "L", factor: 10, drained: false });
expect(normalizeUnit("  UNIDAD ", 1).group).toBe("unidad");
expect(normalizeUnit("", 0).group).toBe("sin_dato");
expect(normalizeUnit("Kilo", 0).group).toBe("sin_dato");
expect(normalizeUnit("Metro", 1).group).toBe("sin_dato");

// synthetic product
const p = { product_format: "Kilo", product_format_quantity: 1,
  price: [{ store: "200", listPrice: 3459, formatPrice: 6918 }, { store: "061", listPrice: 2995, formatPrice: 5990 }],
  discounts: [{ discountPrice: "$2594.25" }],
  discounts_payment_methods: [{ precioCuota: "$2500", cantidadCuotas: "1" }, { precioCuota: "$500", cantidadCuotas: "6" }] };
expect(pickStorePrice(p, "061")).toEqual({ listPrice: 2995, formatPrice: 5990 });
expect(pickStorePrice(p, "999").listPrice).toBe(3459);   // fallback: first entry
expect(finalPrice(p, "200")).toBe(2500);                 // 6-cuota entry ignored
expect(unitPrice(p, "200")).toEqual({ group: "kg", value: 5000, drained: false });
expect(unitPrice({ ...p, price: [{ store: "200", listPrice: 0, formatPrice: 0 }] }, "200").group).toBe("sin_dato");
```

Fixture test: every result in `pastas-rellenas.json` gets group `kg`; the product named `Ravioles Jamón y queso CIUDAD DEL LAGO 500g` has `unitPrice(...,"200").value` ≈ `2 * finalPrice` (500 g item) within 0.01.

- [ ] **Step 4: Run** `npm test` → FAIL (modules missing).

- [ ] **Step 5: Implement** `src/money.js` and `src/unit-price.js`

`parseMoney`: strip everything except digits, `.`, `,`. If both `.` and `,` exist, `.` is thousands and `,` decimal. If only `,`, it is decimal. If only `.`: exactly 3 digits after the last `.` means thousands (`"$12.099"` → 12099), otherwise decimal (`"$2588.72"`). Coto prices never have 3 decimals. `normalizeUnit`: lowercase, strip accents (`normalize("NFD").replace(/\p{Diacritic}/gu,"")`), trim; `drained` = contains `escurrido`; base word picks group (`kilo`, `kilogramo` → kg factor 1; `gramos` → kg factor `1000/qty`; `litro` → L 1; `mililitros` → L `1000/qty`; `unidad` → unidad 1). `qty` falsy → `sin_dato`. `unitPrice.value = finalPrice × (formatPrice ÷ listPrice) × factor`.

- [ ] **Step 6: Run** `npm test` → PASS.

- [ ] **Step 7: Commit** `git add -A && git commit -m "feat: unit price calculator with fixtures"`

---

### Task 2: Sorter

**Files:**
- Create: `src/sort.js`
- Test: `tests/sort.test.js`

**Interfaces:**
- Consumes: `unitPrice` (Task 1).
- Produces: `sortByUnitPrice(results: Array<{data}>, store: string): { results: Array, labels: Record<string /*data.url*/, { group, value, drained, groupStart: boolean }> }`

- [ ] **Step 1: Write failing tests**

- Synthetic list: 2 kg, 3 L, 1 unidad, 2 sin_dato (sin_dato in order X, Y) → output order: L (ascending), kg (ascending), unidad, X, Y. `labels` has `groupStart: true` exactly on the first L, first kg, first unidad. No label entry for sin_dato.
- Tie: 2 kg and 2 L → kg first.
- Input array is not mutated.
- Fixture `aceite.json`: first result group is `L`; values within each group are non-decreasing.

- [ ] **Step 2: Run** `npm test -- sort` → FAIL.

- [ ] **Step 3: Implement** `sortByUnitPrice` per spec section "Ordenador". Stable sort.

- [ ] **Step 4: Run** `npm test` → PASS.

- [ ] **Step 5: Commit** `git commit -am "feat: sort by unit price with unit groups"` (add new files first).

---

### Task 3: Response helpers

**Files:**
- Create: `src/response.js`
- Test: `tests/response.test.js`

**Interfaces:**
- Produces:
  - `UNIT_SORT_OPTION` (the verbatim object from Global Constraints)
  - `isProductsUrl(url: string): boolean`
  - `isUnitSort(url: string): boolean` — `sort_by=unit_price`
  - `toNativeSort(url: string): string` — sets `sort_by=price`, `sort_order=ascending`
  - `cacheKey(url: string): string` — URL without `page`, `num_results_per_page`, `i`, `s`; other params sorted
  - `pageUrl(url: string, page: number, size: number): string`
  - `requestedPage(url: string): { page: number, size: number }` — defaults `page=1`, `size=24`
  - `withSortOption(json, selected: boolean): json` — returns a copy; adds option once; if `selected`, marks it `"selected"` and clears others
  - `withResults(json, results: Array): json` — copy with `response.results` replaced, `total_num_results` kept
  - `storeOf(url: string): string` — `us` param, default `"200"`

- [ ] **Step 1: Write failing tests**

```js
const u = API + "categories/catv00001869?sort_by=unit_price&sort_order=ascending&page=3&num_results_per_page=24&us=200&us=200&i=abc&s=1&filters=x";
expect(isUnitSort(u)).toBe(true);
expect(new URL(toNativeSort(u)).searchParams.get("sort_by")).toBe("price");
expect(cacheKey(u)).toBe(cacheKey(u.replace("page=3", "page=1").replace("i=abc", "i=zzz")));
expect(cacheKey(u)).not.toBe(cacheKey(u.replace("filters=x", "filters=y")));
expect(requestedPage(u)).toEqual({ page: 3, size: 24 });
expect(storeOf(u)).toBe("200");
const j = { response: { sort_options: [{ sort_by: "price", status: "selected" }], results: [] } };
const out = withSortOption(withSortOption(j, true), true);
expect(out.response.sort_options.filter(o => o.sort_by === "unit_price")).toHaveLength(1);
expect(out.response.sort_options[0].status).toBe("");
expect(j.response.sort_options).toHaveLength(1); // not mutated
expect(isProductsUrl(API + "search/aceite?x=1")).toBe(true);
expect(isProductsUrl(API + "recommendations/popular-searches")).toBe(false);
```

- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** with `URL`/`URLSearchParams`. **Step 4: Run** → PASS.

- [ ] **Step 5: Commit** `git add -A && git commit -m "feat: API url and response helpers"`

---

### Task 4: XHR interceptor

**Files:**
- Create: `src/interceptor.js`, `src/main.js`
- Test: `tests/interceptor.test.js` (with a `FakeXHR` class defined in the test)

**Interfaces:**
- Consumes: Tasks 2–3.
- Produces:
  - `installInterceptor(win, deps: { fetch: (url) => Promise<Response-like {ok, json()}>, now: () => number, post: (msg) => void })`
  - Messages posted (consumed by Task 5):
    - `{ source: "coto-unit", type: "labels", active: true, labels }`
    - `{ source: "coto-unit", type: "labels", active: false }`
    - `{ source: "coto-unit", type: "notice", text }`
  - `src/main.js`: `installInterceptor(window, { fetch: window.fetch.bind(window), now: Date.now, post: m => window.postMessage(m, location.origin) })`

- [ ] **Step 1: Write failing tests**

`FakeXHR` mimics what Angular HttpClient uses: `open(method,url)`, `send()`, `addEventListener(type, fn)`, `onload`/`onreadystatechange` properties, `readyState`, `status`, `responseType`, `response`, `responseText`. Its `send()` resolves after a microtask with a JSON body chosen by the test from the requested URL, sets `readyState=4`, `status=200`, then fires `readystatechange` and `load`. Install with `win = { XMLHttpRequest: FakeXHR }`.

Tests (each opens/sends through `new win.XMLHttpRequest()` and awaits `load`):
- Native sort request → response has the unit option with `status: ""`; results unchanged; `post` called with `active:false`.
- Unit sort, page 1, total 250, size 24 → server saw URL with `sort_by=price`; `deps.fetch` called for pages 1 and 2 with `num_results_per_page=200`; response `results` = first 24 of `sortByUnitPrice(all)`; `total_num_results` = 250; posts `labels` with `active:true`.
- Then page 2 same key within 5 min → `deps.fetch` not called again; slice 24–47.
- Same after `now()` + 5 min + 1 ms → fetch called again.
- Direct landing `page=3` → slice 48–71.
- total 1500 → fetches pages 1–5 only, sorts 1000, posts notice `Se ordenaron los primeros 1.000 productos`.
- `deps.fetch` rejects → listener gets the server's own response (sorted by price) plus unit option selected; notice `No se pudo ordenar por precio por kg`.
- Response body without `response.results` → passed through untouched (`responseText` identical).
- `responseType: "json"` and `""`/`"text"` both work.
- Non-products URL → no listener wrapping, untouched.

- [ ] **Step 2: Run** `npm test -- interceptor` → FAIL.

- [ ] **Step 3: Implement `installInterceptor`**

Patch `win.XMLHttpRequest.prototype.open` to record the URL; when `isUnitSort`, pass `toNativeSort(url)` to the original `open` and flag the instance. For product URLs, patch the instance in `send`:

```
- wrap instance.addEventListener: listeners for "load" and "readystatechange"
  are stored, not registered; other types pass through.
- capture onload / onreadystatechange property setters the same way.
- register one real "readystatechange" listener. On readyState 4:
    try { body = parse(original response per responseType) }
    catch → replay stored listeners untouched, return.
    if !body?.response?.results → replay untouched.
    if unit sort: await getSorted(key, body)  (cache or fetch-all, see below)
                  body = withResults(body, slice); post labels active:true
    else post active:false
    body = withSortOption(body, isUnitSort)
    defineProperty(instance, "response"/"responseText", getters per responseType)
    replay stored readystatechange then load listeners (and on* props) with the original Event objects.
getSorted: cache Map key → { at, results, labels }; valid while now()-at < 300000.
    pages = ceil(min(total, 1000) / 200); fetch pageUrl(original, p, 200) for p=1..pages in parallel;
    concat results, cut to 1000, sortByUnitPrice(results, storeOf(url)).
    any fetch fails → throw; caller posts failure notice and keeps the server body.
```

- [ ] **Step 4: Run** `npm test` → PASS.

- [ ] **Step 5: Commit** `git add -A && git commit -m "feat: XHR interceptor for unit price sort"`

---

### Task 5: Badges and notice

**Files:**
- Create: `src/badge.js`, `src/badge.css`
- Test: `tests/badge.test.js` (`// @vitest-environment jsdom`)

**Interfaces:**
- Consumes: messages from Task 4.
- Produces: `installBadges(win, doc)`; `formatBadge(label): string|null`; `groupMark(group): string`

- [ ] **Step 1: Write failing tests**

```js
expect(formatBadge({ group: "kg", value: 5177.4, drained: false })).toBe("$5.177/kg final");
expect(formatBadge({ group: "L", value: 3000, drained: true })).toBe("$3.000/L escurrido");
expect(formatBadge({ group: "unidad", value: 950, drained: false })).toBe("$950/unidad final");
expect(groupMark("L")).toBe("▸ Por litro");
```

DOM tests: body has a card `<div class="card"><a href="/productos/x/_/R-00286626-00286626-200">..</a></div>`. Post `labels` (active true) with key `_/R-00286626-00286626-200` and `groupStart:true` → card contains one `.coto-unit-badge` with the text and one `.coto-unit-mark`; the original `<a>` is still the first child. Adding a new card later (MutationObserver) gets a badge. Posting `labels` again does not duplicate. Posting `active:false` removes all `.coto-unit-badge`/`.coto-unit-mark`. Posting `notice` inserts one `.coto-unit-notice` with the text before the grid (`#plpSort` closest container, else `body` first child). Messages with another `source` are ignored.

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement.** Card = closest ancestor of an `<a>` whose `href` contains the label key and that also contains a button with text `Agregar`; append badge to that card. Badge styles in `badge.css`: small, Coto red `#e30613` text, no layout shift beyond one line.

- [ ] **Step 4: Run** `npm test` → PASS.

- [ ] **Step 5: Commit** `git add -A && git commit -m "feat: unit price badges and notices"`

---

### Task 6: Manifest, build, manual check

**Files:**
- Create: `manifest.json`, `build.mjs`, `README.md`

- [ ] **Step 1: Write `manifest.json`**

```json
{
  "manifest_version": 3,
  "name": "Coto precio por unidad",
  "version": "0.1.0",
  "description": "Ordena Coto Digital por precio final por kg, litro o unidad.",
  "host_permissions": ["https://api.coto.com.ar/*"],
  "content_scripts": [
    { "matches": ["https://www.coto.com.ar/*"], "js": ["dist/interceptor.js"], "world": "MAIN", "run_at": "document_start" },
    { "matches": ["https://www.coto.com.ar/*"], "js": ["dist/badge.js"], "css": ["src/badge.css"], "run_at": "document_idle" }
  ]
}
```

- [ ] **Step 2: Write `build.mjs`** — esbuild, `bundle: true`, `format: "iife"`, entries `src/main.js` → `dist/interceptor.js`, `src/badge.js` (entry that calls `installBadges(window, document)`) → `dist/badge.js`. Add `dist/` and `node_modules/` to `.gitignore`.

Run: `npm run build`. Expected: `dist/interceptor.js` and `dist/badge.js` exist.

- [ ] **Step 3: Manual check in Chrome** (`chrome://extensions` → Developer mode → Load unpacked → project folder)

Expected on https://www.coto.com.ar/productos/categorias/catalogo-frescos/pastas-frescas-y-tapas/pastas-rellenas/catv00001869:
- Menu shows `Precio por kg/L: menor a mayor`; selecting it puts the lowest `$/kg final` first; badges show; page 2 continues the order.
- A product with 2x1 shows its 2x1 per-kg price.
- `Agregar` adds to cart; cart total matches Coto's own price.
- Switch to `Precio: de menor a mayor` → native order, no badges. Switch back → works.
- Search "aceite" → `▸ Por litro` group first.
- Reload on `?sort_by=unit_price&page=2` → page 2 of the unit order.

- [ ] **Step 4: README** — 5 lines: what it does, `npm install`, `npm run build`, load unpacked, `npm test`.

- [ ] **Step 5: Commit** `git add -A && git commit -m "feat: manifest, build and README"`
