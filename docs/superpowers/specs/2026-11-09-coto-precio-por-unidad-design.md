# Coto: ordenar por precio por unidad — Diseño

Fecha: 2026-11-09

## Objetivo

Agregar al menú "Ordenar por" de coto.com.ar una opción nueva:
**"Precio por kg/L: menor a mayor"**. El orden usa el precio final con
todas las ofertas. Todo lo nativo de Coto sigue funcionando: tarjetas,
botón "Agregar", carrito, filtros, paginación y cálculos.

## Alcance

- Extensión de Chrome, Manifest V3, para escritorio.
- Funciona en páginas de categoría y en páginas de búsqueda.
- Fuera de alcance: promos de bancos por día, orden "mayor a menor"
  por unidad, celular.

## Datos verificados de Coto (2026-11-09)

- La página es Angular. Pide los productos por XHR a:
  - `https://api.coto.com.ar/api/v1/ms-digital-sitio-bff-web/api/v1/products/categories/{catId}?...`
  - `https://api.coto.com.ar/api/v1/ms-digital-sitio-bff-web/api/v1/products/search/{término}?...`
- Parámetros relevantes: `sort_by`, `sort_order`, `page`,
  `num_results_per_page` (máximo 200; 500 da error "out of range"),
  `us` (número de sucursal).
- La URL de la página refleja el orden: `?sort_by=...&sort_order=...&page=N`.
- El menú `<select id="plpSort">` se arma con `response.sort_options`
  de la respuesta. Cada opción tiene `sort_by`, `sort_order`,
  `display_name`, `status` (`"selected"` o `""`), `hidden`.
- Cada producto (`response.results[].data`) trae:
  - `price[]`: una entrada por sucursal, con `store`, `listPrice`,
    `formatPrice` (precio por unidad de formato, calculado sobre el
    precio de lista).
  - `product_format`: nombre de la unidad. Valores vistos: `Kilo`,
    `Kilogramo`, `Kilo escurrido`, `Gramos`, `Litro`,
    `Litro escurrido`, `Unidad`, vacío.
  - `product_format_quantity`: cantidad de la unidad (ej. `1` para
    Kilo, `100` para Gramos, `0` cuando no hay formato).
  - `discounts[]`: ofertas, con `discountText` (ej. `25%Dto`, `2x1`),
    `takingText` (ej. `Llevando 2`) y `discountPrice` (texto, ej.
    `"$2588.72"`, precio efectivo por unidad).
  - `discounts_payment_methods[]`: precio con medio de pago, con
    `precioCuota` (texto, ej. `"$2588.72"`) y `cantidadCuotas`.
- `formatPrice` ignora las ofertas. Ejemplo: ravioles $3.459 con 25%
  off → Coto muestra $6.918/kg, el real es $5.177/kg.

## Prueba de concepto (hecha)

Se probó en la página de pastas rellenas, parcheando
`XMLHttpRequest` desde la consola:

1. Se agregó una opción a `sort_options` → apareció en el menú nativo.
2. Al elegirla, se cambió `sort_by=unit_price` por `sort_by=price` en
   el pedido, y se reordenó `results` en la respuesta → Angular dibujó
   las tarjetas nativas en ese orden.
3. Los 24 botones "Agregar" eran los nativos de Coto.

## Arquitectura

Tres módulos, cada uno con una sola tarea.

### 1. Calculadora — `src/unit-price.js`

Funciones puras, sin acceso al DOM ni a la red.

- `normalizeUnit(product_format, product_format_quantity)` →
  `{ group: "kg" | "L" | "unidad" | "sin_dato", factor, drained }`.

  | `product_format` | group | factor | drained |
  |---|---|---|---|
  | Kilo, Kilogramo | kg | 1 | no |
  | Kilo escurrido | kg | 1 | sí |
  | Gramos (cantidad N) | kg | 1000 / N | no |
  | Litro | L | 1 | no |
  | Litro escurrido | L | 1 | sí |
  | Mililitros (cantidad N) | L | 1000 / N | no |
  | Unidad | unidad | 1 | no |
  | vacío, desconocido o cantidad 0 | sin_dato | — | — |

  La comparación de texto ignora mayúsculas, acentos y espacios.
- `finalPrice(data, store)` → el número más bajo entre:
  `listPrice` de la sucursal, cada `discounts[].discountPrice` y cada
  `discounts_payment_methods[].precioCuota`. Los textos tipo
  `"$2588.72"` se pasan a número. Si un valor no se puede leer, se
  ignora.
- `unitPrice(data, store)` → `{ group, value, drained }`, donde
  `value = finalPrice × (formatPrice ÷ listPrice) × factor`.
  Si falta `formatPrice` o `listPrice`, o es 0, el grupo es `sin_dato`.
- Elección de sucursal: la entrada de `price[]` cuyo `store` coincide
  con el parámetro `us` del pedido. Si no hay coincidencia, la primera
  entrada.

### 2. Ordenador — `src/sort.js`

Función pura `sortByUnitPrice(results, store)`:

1. Calcula `unitPrice` de cada producto.
2. Arma los grupos `kg`, `L`, `unidad`. Ordena cada uno por `value`
   de menor a mayor.
3. Orden de grupos `kg` y `L`: primero el que tiene más productos.
   Si empatan, `kg` primero. Después va `unidad`. Al final, `sin_dato`
   en el orden original de Coto.
4. Marca el primer producto de cada grupo (`groupStart: true`).

Devuelve la lista nueva y un mapa `data.url → { group, value,
drained, groupStart }` para las etiquetas.

### 3. Intermediario — `src/interceptor.js`

Corre en el contexto de la página (`"world": "MAIN"`,
`"run_at": "document_start"`) para parchear `XMLHttpRequest` antes
de que cargue Angular.

Para cada XHR a `/products/categories/` o `/products/search/`:

- **Siempre:** agrega a `response.sort_options` la opción
  `{ sort_by: "unit_price", sort_order: "ascending",
  display_name: "Precio por kg/L: menor a mayor", hidden: false }`.
  Si el pedido es nuestro, la marca `selected` y desmarca las demás.
- **Si la URL tiene `sort_by=unit_price`:**
  1. Cambia el pedido a `sort_by=price&sort_order=ascending` para que
     la API lo acepte.
  2. Cuando llega la respuesta, lee `total_num_results`.
  3. Pide todas las páginas con `num_results_per_page=200`, usando el
     `fetch` original (sin parchear). Tope: 1.000 productos.
  4. Ordena con `sortByUnitPrice`.
  5. Guarda la lista en caché. Llave: la URL sin `page` ni
     `num_results_per_page`.
  6. Devuelve a Angular solo la porción de la página pedida, del
     tamaño que pidió Angular (24). Mantiene `total_num_results`.
- Pedidos de página 2, 3, etc. con la misma llave usan la caché.
  La caché dura 5 minutos.
- La respuesta modificada se entrega redefiniendo `response` y
  `responseText` en esa instancia de XHR, respetando `responseType`.
  Los eventos `readystatechange` y `load` se retrasan hasta tener la
  lista completa.

### 4. Etiqueta — `src/badge.js`

Content script normal. Un `MutationObserver` vigila la grilla.
Cada tarjeta se une a su producto por el link de la tarjeta: el `href`
contiene `data.url` (ej. `_/R-00286626-00286626-200`). El mapa de
etiquetas usa esa `data.url` como llave. Para cada tarjeta cuyo
producto está en el mapa:

- Agrega un elemento chico: `$5.177/kg final`. Si es escurrido:
  `$X/kg escurrido`. Grupo `unidad`: `$X/unidad`. Grupo `sin_dato`:
  nada.
- Si `groupStart`: agrega también `▸ Por kilo`, `▸ Por litro` o
  `▸ Por unidad`.
- Solo agrega nodos. No mueve ni borra nada de Coto.
- Las etiquetas solo aparecen cuando el orden activo es `unit_price`.

El intermediario pasa el mapa a la etiqueta con `window.postMessage`.

## Manejo de errores

Regla: si algo falla, Coto se comporta como si la extensión no
existiera.

- La respuesta no tiene la forma esperada → se devuelve sin tocar.
- Falla una tanda de 200 → se devuelve la respuesta de Coto ordenada
  por precio, y se muestra un aviso arriba de la grilla:
  "No se pudo ordenar por precio por kg".
- Un producto sin datos → grupo `sin_dato`.
- Más de 1.000 productos → se ordenan los primeros 1.000 y se muestra
  el aviso "Se ordenaron los primeros 1.000 productos".

## Pruebas

- **Vitest** para `unit-price.js` y `sort.js`. Usa respuestas reales
  guardadas en `tests/fixtures/`:
  - `pastas-rellenas.json`: kg, Kilogramo, Kilo escurrido, 25% off, 2x1.
  - `aceite.json`: L, kg, Litro escurrido, más de 200 resultados.
  - `busqueda-mixta.json`: productos sin formato, Gramos, Unidad.
- **Vitest + XHR falso** para `interceptor.js`: opción en el menú,
  cambio de `sort_by`, paginación desde la caché, respuesta sin tocar
  si el JSON es raro.
- **Prueba manual en Chrome** con la extensión cargada sin empaquetar:
  - Link de pastas rellenas: orden, etiquetas, página 2.
  - Búsqueda "aceite": grupo L primero.
  - "Agregar" suma al carrito y el total del carrito es correcto.
  - Cambiar a otro orden nativo y volver.

## Estructura de archivos

```
manifest.json
src/
  unit-price.js
  sort.js
  interceptor.js
  badge.js
  badge.css
tests/
  fixtures/
  unit-price.test.js
  sort.test.js
  interceptor.test.js
package.json
```
