# v5: comparar precios con Carrefour, Día y Más

Aprobado por el usuario el 2026-11-09. Contexto de producto: `PRODUCT.md`.

## 0. Objetivo

En cada producto de coto.com.ar se ve el precio del mismo producto en Carrefour, Día y
Más (Changomás), con un ícono: ▼ ahí es más barato, = casi igual, ▲ ahí es más caro.

Fuera de alcance: Jumbo, Disco, Vea (andan, pero el usuario no los eligió), Libertad
(responde 403), precios por zona o sucursal, descuentos bancarios de los otros súper.

## 1. Lo que se verificó (2026-11-09, en vivo)

- La API de Coto trae `product_main_ean` (código de barras EAN-13) en cada producto.
- Carrefour (`www.carrefour.com.ar`), Día (`diaonline.supermercadosdia.com.ar`) y Más
  (`www.masonline.com.ar`) son tiendas VTEX con API pública, sin login:
  - Búsqueda: `GET /api/catalog_system/pub/products/search?fq=alternateIds_Ean:A&fq=alternateIds_Ean:B…&_from=0&_to=49`.
    Repetir `fq` del mismo campo funciona como OR: hasta 50 productos por consulta.
    El precio está en `items[0].sellers[0].commertialOffer.Price` (ya incluye ofertas simples,
    ej. Día fideos $1240 con lista $2200).
  - Carrito simulado: `POST /api/checkout/pub/orderForms/simulation?sc=1` con
    `{ items: [{ id: itemId, quantity: q, seller: sellerId }], country: "ARG" }`.
    La suma de `totals[].value / 100` es el total con promos por cantidad aplicadas.
    `ratesAndBenefitsData.rateAndBenefitsIdentifiers[].name` es el nombre de la promo.
    Ejemplos: Coca-Cola 2,25 L en Día, 2 u. = $9150 ("2do al 50%"); leche La Serenísima
    1 L en Día, 2 u. = $3798 ("Llevando 2 a $1899 c/u").
- Los textos de promo de la búsqueda (`PromotionTeasers`) no traen números y Más no los
  manda. Por eso no se interpretan textos: el súper calcula la promo en el carrito simulado.
- 20 consultas paralelas por súper: todas HTTP 200, sin bloqueo.

## 2. Qué precio se compara

- **Mismo producto = mismo EAN.** Sin EAN, o producto pesable (`product_weighable`),
  no hay comparación.
- **Coto**: el mejor precio por unidad del paquete con ofertas de Coto (incluye NxM),
  **sin banco**. Si el NxM pide N unidades, se guarda N.
- **Otro súper**: carritos simulados con 1, 2 y 3 unidades. Se usa el menor `total / q`.
  Si el mejor es con q > 1, la fila dice "llevando q". Si la simulación falla para q = 1,
  se usa `commertialOffer.Price` de la búsqueda; si falla para 2 o 3, se ignora esa q.
- Producto sin stock en el otro súper (`AvailableQuantity` 0) = "no está".
- **Ícono** (`classify(coto, otro)`): `d = (otro − coto) / coto`.
  `d < −1%` → ▼ "más barato"; `|d| ≤ 1%` → = "igual"; `d > 1%` → ▲ "más caro".

## 3. Piezas

Todas puras y testeables, salvo el cableado.

- `src/stores.js`: lista fija de súper:
  `{ id: "carrefour", name: "Carrefour", host: "www.carrefour.com.ar", sc: 1 }`, igual
  para `dia` y `mas`. Sumar un súper VTEX = sumar una línea (Jumbo usaría `sc: 32`).
- `src/vtex.js`:
  - `searchUrl(store, eans)` y `parseSearch(json)` → `Map<ean, { itemId, seller, price, stock, name }>`.
  - `simulationRequest(store, item, q)` y `parseSimulation(json)` → `{ total, promo } | null`.
  - `bestOffer(searchHit, sims)` → `{ unit, qty, promo } | null`.
- `src/compare.js`: `classify(cotoUnit, otherUnit)` → `"lower" | "equal" | "higher"`;
  `cotoUnitPrice(label)` → `{ unit, qty } | null` a partir de la etiqueta que ya arma
  `unit-price.js`.
- `src/price-cache.js`: memoria por `store:ean` con vencimiento de 6 h en
  `chrome.storage.local` (clave `cmpCache`). Guarda también "no está" (para no volver a
  buscar). No guarda errores. Se recorta a 3000 entradas, las más viejas primero.
- `src/background.js` (service worker, empaquetado con esbuild como IIFE, igual que el resto):
  recibe `{ type: "compare", eans: [...] }` por `chrome.runtime.onMessage`, responde
  `{ [ean]: { [storeId]: { unit, qty, promo } | "missing" | "error" } }`.
  Por súper: 1 búsqueda cada 50 EAN pendientes, después 3 simulaciones por producto,
  máximo 4 consultas a la vez por súper, tiempo máximo 8 s por consulta.
  Pedidos iguales en vuelo se comparten (no se piden dos veces).
- `src/compare-ui.js`: `paintCompare(box, rows, variant)` agrega
  `.coto-unit-cmp` dentro de la caja actual. Solo agrega nodos; nunca toca nodos de Coto.

## 4. Flujo de datos

1. `interceptor.js` (mundo MAIN) ya arma etiquetas por producto. Ahora cada etiqueta suma
   `ean` y `cmp: { unit, qty }` (precio Coto para comparar, o `null`).
2. `badge.js` (mundo aislado) pinta la caja como hoy. Si la etiqueta tiene `ean` y `cmp`,
   observa la caja con `IntersectionObserver`. Cuando entra en pantalla, junta EAN durante
   150 ms y manda un solo `chrome.runtime.sendMessage({ type: "compare", eans })`.
3. `background.js` responde con lo que tiene en memoria y lo que consiguió.
4. `badge.js` guarda el resultado por EAN y llama a `paintCompare`. Mientras espera,
   cada fila muestra "…".

## 5. Cómo se ve

- **Tarjeta de lista y ficha (PDP)**: debajo del valor de la caja azul, un bloque con una
  fila por súper, en el orden de `stores.js`: nombre a la izquierda; ícono + precio por
  unidad a la derecha; si `qty > 1`, una línea chica "llevando 2". Colores: ▼ rojo
  (`ti-arrow-down`), = gris, ▲ verde. Leyenda solo en la pestaña Ayuda.
- **Carrusel (`--mini`) y carrito**: una sola línea con el súper más barato:
  "Día $1.899 ▼". Si Coto es el más barato o igual: "Coto el más barato" en verde.
- Fila sin dato: "Carrefour —" en gris ("no está" o error; el `title` dice cuál).
- Números con `tabular-nums` y formato `$1.899` (el mismo formateador que usa `formatValue` en `badge.js`).

## 6. Errores

- Súper caído, HTTP ≠ 200, JSON roto, tiempo agotado → `"error"` → la fila muestra "—".
  No se reintenta hasta que se recarga la página. No se guarda en memoria.
- Si `cmp` de Coto es `null` (precio dudoso) → no se pinta el bloque.
- Si `precio otro / precio Coto` está fuera de `[0.4, 2.5]` → la fila muestra "—" con
  título "Dato dudoso" (probable EAN mal cargado o pack distinto).
- Si la extensión no tiene el permiso de un host (instalación vieja) → ese súper da
  `"error"`.
- El service worker puede dormirse: la memoria vive en `chrome.storage.local`, no en
  variables.

## 7. Permisos, ajustes y textos

- `manifest.json`: `host_permissions` para los 3 hosts; `background.service_worker:
  "dist/background.js"`; versión `0.5.0`. `build.mjs` suma el bundle de background.
- Popup, Ajustes: interruptor `compareStores` "Comparar con otros súper" (default on).
  Apagado: `badge.js` no pide nada y no pinta el bloque. Se pasa por `bridge.js` (sumar a
  `KEYS`).
- Popup, Ayuda: qué significa cada ícono; "Precios de la web de cada súper, zona por
  defecto. Pueden variar en tu sucursal. Sin descuentos bancarios."
- `PRODUCT.md`: "No host permissions, no external servers" pasa a "Only sends barcodes
  (EAN) to Carrefour, Día and Más public APIs to compare prices; no own servers, no
  personal data". Mismo cambio en Positioning.

## 8. Pruebas

- `scripts/capture-fixtures.mjs` suma respuestas reales de búsqueda y simulación de los
  3 súper para 5 EAN (aceite Cocinero, yerba Playadito, leche La Serenísima, Coca-Cola
  2,25 L, fideos Matarazzo) en `tests/fixtures/vtex-*.json`.
- Tests (`vitest`): `parseSearch`, `parseSimulation`, `bestOffer` (q = 2 gana, simulación
  fallida, sin stock), `classify` (bordes ±1%), `cotoUnitPrice` (NxM, sin oferta, dudoso),
  `price-cache` (vence a las 6 h, guarda "missing", no guarda "error", recorte),
  `background` con `fetch` falso (lotes de 50, máximo 4 en paralelo, pedidos compartidos),
  `compare-ui` (filas, "llevando 2", variante mini, "Coto el más barato", "—").
- Prueba manual: cargar la extensión, abrir una categoría, una ficha y el carrito en
  coto.com.ar; ver que las filas aparecen y que Coto sigue funcionando igual.
