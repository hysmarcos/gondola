# Información nutricional en la página de producto

Aprobado por el usuario el 2026-11-09. Contexto de producto: `PRODUCT.md`.

## 0. Objetivo

En la página de producto (PDP) de coto.com.ar, Góndola muestra la tabla nutricional del
producto cuando existe. La fuente es Open Food Facts, una base abierta y colaborativa. La
búsqueda es por código de barras (EAN). Si la base no tiene la tabla, se muestra una línea
que invita a cargarla.

Fuera de alcance en esta versión:

- Octógonos (sellos de la Ley 27.642). Hay que calcularlos, y un sello mal calculado parece
  un dato oficial. Quedan para una versión futura, con tests contra envases reales.
- Datos de ANMAT (ver la sección 1).
- Información nutricional en las tarjetas de la grilla, el carrusel o el carrito.
- Ingredientes, alérgenos y Nutri-Score.

## 1. Lo que se verificó (2026-11-09, en vivo)

**Muestra:** 300 productos de Coto con EAN, de 25 rubros (12 por rubro): galletitas, yogur,
leche, fideos, arroz, aceite, gaseosa, jugo, cerveza, queso, dulce de leche, mermelada,
cereales, chocolate, alfajor, snacks, salsa de tomate, atún, pan lactal, hamburguesas,
mayonesa, galletas de arroz, yerba, café y helado.

**Open Food Facts** (`GET https://world.openfoodfacts.org/api/v2/product/{ean}`):

| Resultado | Productos |
|---|---|
| Existe en la base | 259/300 (86%) |
| Tabla completa (5 o más nutrientes) | 184/300 (61%) |
| Tabla parcial | 9/300 (3%) |
| Ficha sin tabla | 66/300 (22%) |

- Rubros con buena cobertura: fideos 12/12, yogur 11/12, galletas de arroz 11/12, y
  galletitas, alfajor, mayonesa, salsa de tomate y pan lactal 10/12.
- Rubros con mala cobertura: cerveza 0/12, helado 0/12, café 1/12, jugo 3/12.
- La búsqueda masiva (`/api/v2/search`) respondió 503. La consulta por producto anduvo bien.
- Licencia: ODbL. Se puede usar si se nombra la fuente.

**ANMAT, buscador nutricional del SIFeGA** (`https://inal.sifega.anmat.gob.ar/consultadealimentos/`):

- Tiene unos 107.000 productos con tabla, y una exportación a Excel con calorías,
  carbohidratos, azúcar, proteínas, grasas totales, saturadas y trans, fibra y sodio.
- No busca por EAN. Solo busca por RNPA, marca o nombre.
- No tiene datos de CABA, Provincia de Buenos Aires ni Córdoba, donde se registran la
  mayoría de las marcas grandes.
- Cruce por marca y parecido de nombre: 27/300 con coincidencia buena (≥ 0,8) y 48/300 con
  coincidencia floja (≥ 0,6). Hubo errores, por ejemplo "Aceite Natura" unido con
  "Salsa Golf Natura". Solo agrega entre 10 y 18 productos que Open Food Facts no tiene.
- Decisión: no se usa ANMAT.

**Otras fuentes descartadas:** Carrefour, Día y Más no traen la tabla nutricional en su API
ni en la descripción. GS1 Argentina pide membresía paga y no confirma datos nutricionales.

## 2. Cuándo se muestra

Se cumplen las cuatro condiciones:

1. Es una PDP de Coto y Góndola ya tiene la etiqueta del producto (`state.labels[key]`).
2. La etiqueta tiene un EAN válido (`label.ean`, el mismo del comparador).
3. El producto es comida o bebida. Alguno de sus `groups[].group_id` es una de estas
   categorías raíz de Coto:
   - Almacén `catv00001254`
   - Frescos `catv00001255`
   - Bebidas `catv00001256`
   - Congelados `catv00001296`
4. El ajuste "Información nutricional" está prendido. Viene prendido por defecto.

Los productos pesables (`product_weighable` = 1 o unidad `KGS`) no muestran la sección,
aunque tengan EAN: su código no es el de un envase con tabla.

## 3. Piezas

### Nuevas

**`src/nutrition.js`**: funciones puras, sin red.

- `parseOff(json, ean)` recibe la respuesta de Open Food Facts y devuelve:
  - `{ per100, perServing, servingSize, url }` cuando hay al menos 3 nutrientes válidos
    por 100 g.
  - `"missing"` si el producto no existe o no tiene tabla.
- `per100` y `perServing` tienen estas claves, todas opcionales:
  `kcal`, `carbs`, `sugars`, `proteins`, `fat`, `saturatedFat`, `transFat`, `fiber`,
  `sodiumMg`.
- Campos de Open Food Facts que se leen: `energy-kcal_100g`, `carbohydrates_100g`,
  `sugars_100g`, `proteins_100g`, `fat_100g`, `saturated-fat_100g`, `trans-fat_100g`,
  `fiber_100g` y `sodium_100g`, y los mismos con `_serving`. También `serving_size`.
- El sodio viene en gramos y se pasa a miligramos (× 1000).
- Un valor se descarta si no es un número, si es negativo, si los gramos pasan de 100 cada
  100 g o si las calorías pasan de 900 cada 100 g.
- `url` es `https://world.openfoodfacts.org/product/{ean}`.
- `isFood(groups)` dice si el producto está en una de las categorías del punto 2.

**`src/nutrition-service.js`**: vive en el service worker.

- `createNutritionService({ fetch, cache, timeoutMs = 8000 })` devuelve `{ get(ean) }`.
- `get(ean)` nunca rechaza. Devuelve el objeto de `parseOff`, `"missing"` o `"error"`.
- Primero mira la memoria. Si no está, pide
  `https://world.openfoodfacts.org/api/v2/product/{ean}?fields=product_name,nutriments,serving_size`.
- El pedido va con `credentials: "omit"` y `AbortSignal.timeout(timeoutMs)`.
- Si dos pedidos piden el mismo EAN al mismo tiempo, se hace un solo pedido a la red.
- HTTP 404 se trata como `"missing"`. Otros errores, o pasar el tiempo máximo, dan `"error"`.
- Guarda en la memoria el resultado y `"missing"`. No guarda `"error"`, así se reintenta
  la próxima vez.

**`src/nutrition-ui.js`**: dibuja la sección en la PDP.

- `createNutritionUi(doc, { request, onUpdate })` devuelve `{ paint(container, anchor, label, enabled) }`.
  `request(ean)` devuelve una promesa con el resultado del servicio. `onUpdate()` pide un
  repintado cuando llega un resultado. `badge.js` llama a `paint` desde `renderPdp`,
  porque ahí viven las etiquetas del producto.
- Pide una sola vez por EAN mientras dure la página.
- Va dentro del mismo contenedor que la caja "Precio real para comparar"
  (`.coto-unit-box--pdp`), justo después de ella.
- Se redibuja con el mismo `MutationObserver` que ya usa Coto (la página es una SPA y
  rehace el DOM).

### Cambios en archivos existentes

- **`src/price-cache.js`**: la clave de storage pasa a ser una opción:
  `createPriceCache(storage, now, { key = "cmpCache", ttlMs, max })`. El comparador sigue
  igual.
- **`src/background.js`**: crea el servicio con
  `createPriceCache(chrome.storage.local, Date.now, { key: "nutriCache", ttlMs: 604_800_000, max: 2000 })`
  (7 días) y atiende `{ type: "nutrition", ean }`.
- **`src/badge-entry.js`**: crea `nutrition-ui` con
  `request: (ean) => chrome.runtime.sendMessage({ type: "nutrition", ean }).catch(() => "error")`
  y se lo pasa a `installBadges`, que devuelve `{ refresh }` para el `onUpdate`.
- **`src/bridge.js`**: suma la clave `nutrition` a `KEYS` y manda `nutrition: s.nutrition !== false`
  en el mensaje `settings`.
- **`src/popup.js`**: suma el ajuste
  `{ key: "nutrition", title: "Información nutricional", text: "En la página de un producto, la tabla nutricional de Open Food Facts, si existe." }`.
- **`src/sort.js`**: donde hoy arma la etiqueta con `compareFields` (que da `ean`), suma
  `nutri: isFood(data.groups) && !weighable`. `weighable` usa la misma regla que
  `compareFields`. `nutrition-ui` solo pide datos si `label.nutri` es `true`.
- **`manifest.json`**: suma `https://world.openfoodfacts.org/*` a `host_permissions`.

## 4. Recorrido del dato

1. El usuario abre una PDP. Góndola ya pide la etiqueta del producto (`lookup`) y la recibe
   con `ean` y `nutri`.
2. Si se cumplen las condiciones del punto 2, `nutrition-ui` llama a `request(ean)`.
3. El service worker busca `nutriCache[ean]`. Si está y tiene menos de 7 días, responde
   con eso.
4. Si no está, pide a Open Food Facts, procesa la respuesta con `parseOff`, la guarda y
   responde.
5. `nutrition-ui` dibuja la tabla, la línea sin datos o nada (si dio `"error"`).

## 5. Cómo se ve

Es un bloque desplegable (`<details>`). Las clases usan el prefijo `coto-unit-nutri` y los
estilos van en `src/badge.css`, con la misma línea visual que la caja de precio.

- **Cerrado:** "Información nutricional · 480 kcal cada 100 g". Si no hay calorías, solo
  "Información nutricional".
- **Abierto:** una tabla con una fila por nutriente presente, en este orden: valor
  energético (kcal), carbohidratos, azúcares, proteínas, grasas totales, grasas saturadas,
  grasas trans, fibra y sodio (mg). Los gramos van con un decimal y los mg y kcal sin
  decimales.
- **Columnas:** "cada 100 g" siempre. "Por porción (…)" solo si hay `perServing` con
  datos; el texto entre paréntesis es `servingSize` tal como viene.
- **Bebidas:** si la unidad del producto en Góndola es litro, dice "cada 100 ml".
- **Pie:** "Fuente: Open Food Facts, datos cargados por la comunidad." y un link
  "Ver ficha" a `url` (`target="_blank"`, `rel="noopener noreferrer"`).
- **Sin tabla (`"missing"`):** una línea: "Sin información nutricional. Podés cargarla en
  Open Food Facts", con link a `https://world.openfoodfacts.org/product/{ean}`.
- **Error:** no se muestra nada.
- **Ajuste apagado:** se borra la sección y no se hacen pedidos.

## 6. Privacidad

- A Open Food Facts solo viaja el EAN. Sin cookies ni datos personales.
- Góndola sigue sin servidores propios.
- Se actualizan `site/privacidad.html` y la sección 5 de `README.md` y `README.en.md`.
  Hay que nombrar a Open Food Facts como servicio externo y decir qué se manda.
- El permiso nuevo hace que Chrome pida aprobación a quien ya tiene la extensión. Hoy no
  afecta a nadie, porque la extensión todavía no está en la Chrome Web Store.
- Atribución ODbL: el pie de la sección nombra a Open Food Facts con un link.

## 7. Tests

Las respuestas reales de Open Food Facts se guardan como fixtures en
`tests/fixtures/off.js`: Coca-Cola 2,25 L (`7790895000997`), un producto con columna por
porción, una ficha sin tabla y un producto que no existe.

- **`tests/nutrition.test.js`**: `parseOff` con las fixtures, el sodio en mg, los valores
  inválidos descartados, menos de 3 nutrientes da `"missing"`, e `isFood` con categorías de
  comida y de limpieza.
- **`tests/nutrition-service.test.js`**: con `fetch` y memoria falsos. Cubre memoria
  vigente y vencida, 404 da `"missing"`, 500 o tiempo máximo dan `"error"` y no se guardan,
  y dos pedidos simultáneos hacen un solo `fetch`.
- **`tests/nutrition-ui.test.js`**: dibuja la tabla, la columna por porción, "cada 100 ml"
  para litros, la línea sin datos, nada con error, nada si no es comida y nada con el
  ajuste apagado.
- **`tests/price-cache.test.js`**: la clave nueva no toca `cmpCache`.

## 8. Listo cuando

- Todos los tests pasan (`npm test`) y el build anda (`npm run build`).
- En coto.com.ar, con la extensión cargada:
  - La PDP de Coca-Cola 2,25 L muestra la tabla.
  - Un producto sin tabla muestra la línea con el link.
  - La PDP de una lavandina no muestra nada.
- La política de privacidad y los README nombran a Open Food Facts.
