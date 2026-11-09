# Coto: descuentos bancarios, promos por cantidad y carrito — Diseño

Fecha: 2026-11-09. Extiende `2026-11-09-coto-precio-por-unidad-design.md`.

## Objetivo

Que un comprador ahorrador vea el precio real que va a pagar:

1. Con la promo de su banco para el día de compra.
2. Sabiendo cuándo una promo exige llevar varias unidades.
3. En el carrito: cuánto paga de verdad, qué le falta para activar una promo y qué día le conviene comprar.

También cierra un hueco: la página de Ofertas no tenía el orden por unidad.

## Datos verificados de Coto (2026-11-09)

- **Ofertas** usa `.../products/offers/{slug}?...`, mismo formato que categorías y búsquedas.
- **Promos por cantidad**: `discounts[].takingText` = `"Llevando N"` (N = 2, 3, 4, 6). `discountPrice` es el precio promedio por unidad llevando N. Ej.: leche COTO 3x2, lista $2.499, `discountPrice` $1.666,08.
- **"+N%"**: `discountPrice` ya trae el precio final. No hace falta nada especial.
- **Promos bancarias**: `GET https://www.coto.com.ar/rest/model/atg/actors/cProfileActor/getPromocionesMulticanal?enviroment=ag&pushSite=CotoDigital` → `result.promocionesDigitales[]` con:
  - `id`, `banco` (número), `icono` (ej. `logo_icbc_1.png`), `descripcion`, `observacion`, `textoDescuento` (ej. `"30% DE DESCUENTO"` o `"12 CUOTAS SIN INTERÉS"`).
  - `dias[].id`: 1 = domingo … 7 = sábado.
  - El tope solo está en el texto de `observacion`: `"Tope de reintegro de $15.000 por transacción"`, `"Sin tope de reintegro"`, `"$12.000 por semana"`.
  - "Solo productos sin oferta" solo está en el texto: `"Aplica en los productos sin oferta"`.
- **Carrito**: Coto lo pide con XHR a `.../cCarritoActor/getCarrito?...`. Respuesta: `output.productoItems` = objeto `{ prodXXXXXXXX: { cantidad, producto: { id, nombre, urlProducto }, precio: { precioLista } } }`.
  - El "Total" de la página `/carrito` usa precio de lista: **no aplica las promos de Coto ni las del banco** (dice "se aplicarán al momento del cobro").
  - Cada línea es un `<card-product>` con el nombre en `a.title`. No tiene link al producto.
  - El total está en `.card-body-container` con el texto `Total:`.
- **Buscar por PLU**: `.../products/search/{PLU sin ceros}` devuelve el producto con sus `discounts`. Ej. `search/299912` → `prod00299912`.
- **Página de producto**: usa otro endpoint con otro formato. Se resuelve buscando por PLU (sale de la URL `_/R-00217832-...`).

## Comportamiento

### Ventana de la extensión (popup)

- Lista las promos de **porcentaje** (las de cuotas no bajan el precio), agrupadas por banco. Cada una con casilla, días, % y tope.
- "Día de compra": `Hoy` (por defecto) o un día de la semana.
- Guarda en `chrome.storage.local`: `promos` (lista ya interpretada + `fetchedAt`), `selectedPromoIds`, `day` (`"hoy"` o 0–6, 0 = domingo).
- Si no hay `promos`: "Abrí coto.com.ar una vez para cargar las promos".

### Etiquetas de producto

Cambio respecto del diseño anterior: las etiquetas se muestran **siempre**, no solo con el orden por unidad. La marca de grupo (`▸ Por kilo`) sigue solo en el orden por unidad.

- Línea 1: `$5.177/kg final`. Si la promo pide N > 1: `$1.666/L llevando 3`. Escurrido como antes.
- Línea 2, si hay promo bancaria elegida que aplica: `Hoy con ICBC: $3.624/kg` (o `Martes con ...` si el día elegido no es hoy).
- Aparecen en listas (categorías, búsquedas, ofertas), carruseles de recomendaciones y página de producto.

### Orden por precio por unidad

- También en la página de Ofertas.
- Ordena por el precio con banco (`bankValue` si existe, si no `value`).

### Carrito (`/carrito`)

- En cada línea con promo "Llevando N" incompleta: `⚠ Agregá 1 más y se activa el 3x2: ahorrás $2.739`.
- Caja debajo del total de Coto:
  - `Total con promos de Coto: $37.454`
  - `Con ICBC hoy: $31.000 (reintegro $6.454)` — usa la mejor promo elegida para el día.
  - `Mejor día: martes con Credicoop, $26.218`
  - Si alguna promo usada tiene tope semanal: `El tope de Naranja X es semanal.`
- No toca el carrito de Coto.

## Reglas de cálculo

### Promo bancaria (`banks.js`)

- `percent`: número de `textoDescuento` si dice `DESCUENTO`; si no, la promo se descarta.
- `days`: `dias[].id - 1` (0 = domingo).
- `cap`: primer monto `$ N` de `observacion` si dice "tope"; `null` si dice "sin tope" / "sin límite" o no hay monto. `capWeekly`: `observacion` dice "semana".
- `onlyNoOffer`: `observacion` contiene "sin oferta".
- `bank`: nombre legible desde `icono` (`logo_icbc_1.png` → `ICBC`); tabla fija para los conocidos, si no el texto limpio en mayúsculas.
- Promo aplicable a un producto: está elegida, vale el día, y no es (`onlyNoOffer` y el producto tiene oferta).
- Mejor promo: la de mayor `percent`.
- Precio con banco de un producto: `finalPrice × (1 − percent/100)`. Sin tope (el tope es por compra).

### Carrito (`cart.js`)

Por línea, con `q` = cantidad, `list` = precio de lista, `p` = precio final por unidad (Tarea 1 del diseño anterior), `N` = unidades de la promo (1 si no hay):

- Si `N > 1`: `grupos = floor(q / N)`; `total = grupos × N × p + (q − grupos × N) × list`; `faltan = q % N ? N − q % N : 0`; `ahorroSiCompleta = N × (list − p)`.
- Si `N = 1`: `total = q × p`; `faltan = 0`.
- `totalConPromos` = suma de líneas.
- Reintegro de una promo: `min(percent% × elegible, cap ?? ∞)`, con `elegible` = suma de líneas, sin las líneas con oferta si `onlyNoOffer`.
- Hoy: la promo elegida con mayor reintegro para el día elegido.
- Mejor día: de 0 a 6, el de mayor reintegro. Empate: gana el día elegido, después el más cercano.

## Arquitectura

### Mundo de la página (`interceptor.js`, ampliado)

- `isProductsUrl` incluye `/products/offers/`.
- `/products/recommendations/`: no reordena; solo publica etiquetas si la respuesta tiene `response.results[].data`.
- Al cargar: pide las promos bancarias y publica `{type: "promos", promos}`.
- Recibe `{type: "settings", selected, day}` desde la extensión. Antes de transformar la primera respuesta espera la configuración hasta 500 ms; si no llega, sigue sin banco.
- Lee (sin modificar) las respuestas de `getCarrito`. Busca cada PLU (caché 5 min), calcula con `cart.js` y publica `{type: "cart", analysis}`.
- Recibe `{type: "lookup", plu, key}` (página de producto), busca y publica etiquetas para esa llave.

### Mundo aislado (`badge.js` + nuevo `bridge.js` + nuevo `cart-ui.js`)

- `bridge.js`: guarda `promos` en `chrome.storage.local`; lee `selectedPromoIds` y `day` y los manda a la página como `settings`; reenvía si cambian.
- `badge.js`: junta etiquetas (las nuevas se suman a las viejas). Marcas de grupo por `seq` como antes. En página de producto pide `lookup` y pone la etiqueta después del primer `.price`.
- `cart-ui.js`: en `/carrito`, une líneas por nombre normalizado (`producto.nombre` vs `a.title`) y agrega avisos y la caja.

### Popup (`popup.html`, `popup.js`)

Lee y escribe `chrome.storage.local`. `manifest.json` suma `"permissions": ["storage"]`, `"action": {"default_popup": "popup.html"}`, y saca `host_permissions` (no se usa).

### Mensajes (todos con `source: "coto-unit"`)

| type | de → a | contenido |
|---|---|---|
| `labels` | página → aislado | `labels` (llave → etiqueta), `marks` (llave → grupo, o `null`), `seq` |
| `notice` | página → aislado | `text`, `seq` |
| `promos` | página → aislado | lista interpretada |
| `settings` | aislado → página | `selected` (promos elegidas completas), `day` (0–6) |
| `lookup` | aislado → página | `plu`, `key` |
| `cart` | página → aislado | `analysis` |

Etiqueta: `{ group, value, drained, take, bankValue, bankName }`.

## Errores

- Igual que antes: si algo falla, Coto se comporta como sin extensión.
- Sin promos o sin configuración: no hay línea de banco ni filas de banco en la caja.
- Una línea del carrito sin datos de búsqueda: cuenta a precio de lista y sin avisos.
- Si el nombre de una línea no coincide: sin aviso para esa línea; la caja igual se muestra.

## Pruebas

- `banks.test.js` con las 14 promos reales de porcentaje del 2026-11-09.
- `cart.test.js` con el carrito real: 6 productos, Dove 3x2 ×3, Listerine 35%, Tresemmé 40%. Total con promos esperado: $37.453,81.
- Tests del intermediario: ofertas, recomendaciones, promos, settings con espera, carrito, lookup.
- `cart-ui` y `badge` con jsdom. `popup` con jsdom y un `chrome.storage` falso.
- Prueba en vivo en Coto con la sesión del usuario: listas, ofertas, producto, carrito.
