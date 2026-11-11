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

Diseño A, aprobado el 2026-11-10 después de ver la versión 1 en coto.com.ar. Las clases usan
el prefijo `coto-unit-nutri` y los estilos van en `src/badge.css`.

**HTML real del PDP de Coto (2026-11-10).** Columna de compra: `div.mt-4` con, en orden,
`div.mb-1`, el bloque del precio (badge, "Llevando…", `var.price`, "No acumulable"),
`div.mt-2.small` "Precio regular", `div.mb-2` "Precio sin impuestos nacionales" y
`div.mb-5.small` "Precio por 1 …". Después vienen "Ver planes de cuotas" y el botón
"Agregar". Debajo de la foto y la columna: `div.col-12.mt-3.mb-5` con `div.pdp-description`
("Descripción del producto") y `div.pdp-characteristics` ("Características").

**Columna de compra, de arriba a abajo:**

1. El bloque del precio de Coto, sin cambios.
2. "Precio regular" y "Precio sin impuestos nacionales", justo debajo del precio, atenuados
   como hoy.
3. La caja "Precio real para comparar" de Góndola. Va **después** de esas dos líneas, no
   entre el precio y ellas.
4. Resumen nutricional en una línea, solo si hay tabla: ícono de Open Food Facts +
   "42 kcal · 11 g azúcares · 6 mg sodio · cada 100 ml" + link "Ver tabla", que lleva a la
   sección. Muestra solo los que existen de: kcal, azúcares, sodio.
5. "Ver planes de cuotas" y "Agregar", de Coto.

Góndola no mueve nodos de Coto: solo elige dónde inserta los suyos.

**Sección "Información nutricional"**, en `div.col-12.mt-3.mb-5`, después de
`div.pdp-description`:

- Título como los de Coto (`h4`), con el ícono de Open Food Facts a la izquierda.
- La tabla siempre visible, sin desplegar: una fila por nutriente presente, en este orden:
  valor energético (kcal), carbohidratos, azúcares, proteínas, grasas totales, grasas
  saturadas, grasas trans, fibra y sodio (mg). Gramos con hasta un decimal ("30 g",
  "70,3 g"); mg y kcal sin decimales.
- Columnas: "cada 100 g" (o "cada 100 ml") siempre. "Por porción (…)" solo si hay
  `perServing`; el paréntesis es `servingSize` tal como viene, y sin él dice "Por porción".
- Pie: "Fuente: Open Food Facts, datos cargados por la comunidad." y un link "Ver ficha" a
  `url` (`target="_blank"`, `rel="noopener noreferrer"`).
- En pantallas de 992 px o más, la descripción y la sección van en dos columnas;
  "Características" queda debajo, a lo ancho. En pantallas chicas, una debajo de la otra.
- **Sin tabla (`"missing"`):** no hay resumen en la columna. La sección muestra el título y
  la línea "Sin información nutricional. Podés cargarla en Open Food Facts", con link a
  `https://world.openfoodfacts.org/product/{ean}`.

**Bebidas:** "cada 100 ml" si la unidad del producto es litro, o si es una bebida
(`catv00001256`) que no se vende por peso.

**Si la página no tiene `div.pdp-description`:** se usa el bloque desplegable de la versión 1
(`<details>`) en la columna de compra, debajo de la caja de Góndola.

**Error:** no se muestra nada. **Ajuste apagado:** se borran el resumen y la sección, y no
se hacen pedidos.

**Ícono de Open Food Facts:** `assets/off/off-logo-icon-light.svg`, copiado sin cambios de
`openfoodfacts/openfoodfacts-server` (`html/images/logos/`). Se usa solo junto a la atribución,
como fuente de los datos. No se encontró una política pública sobre el uso del logo (la wiki
bloquea el acceso automático): antes de publicar en la Chrome Web Store, confirmarlo con
`reuse@openfoodfacts.org`.

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

## 9. Primera ola de mejoras (aprobada el 2026-11-10)

Relevamiento: 100 productos de Coto que están en Open Food Facts (OFF), 2026-11-10.
Porción (`serving_size`) 70%, foto de la tabla 65%, foto de ingredientes 58%, foto del
frente 95%, editado en los últimos 2 años 97%.

**Datos nuevos.** El pedido a OFF suma `serving_quantity`, `last_modified_t`,
`image_front_url`, `image_nutrition_url` e `image_ingredients_url`. `parseOff` devuelve
además `servingQty` (número, g o ml, o null), `updatedAt` (ms, o null) y
`photos: { front, nutrition, ingredients }` (URL o null; solo `https://` de
`images.openfoodfacts.org` o `static.openfoodfacts.org`). La etiqueta de Góndola suma
`amount`: tamaño del envase en kg o L, el mismo que usa el precio por unidad (null si no
se sabe).

1. **Total por envase.** Debajo del título de la sección: "Envase de 400 g · 13 porciones de
   30 g · 1.920 kcal en total". Envase = `amount` × 1000 (g o ml). Porciones =
   envase ÷ `servingQty`, redondeado; solo si da entre 1 y 100. Sin `amount` no hay línea.
   Sin porción, solo "Envase de 400 g · 1.920 kcal en total". Sin kcal, sin el total.
2. **Precio por nutriente.** Línea "Rinde:" en la sección, con el precio real de Góndola
   por kg o L (`bankValue` si hay banco, si no `value`), solo para grupos `kg` y `L`:
   - "$X cada 100 g de proteína" si hay 5 g o más de proteína cada 100. Cuenta:
     precio por kg × 10 ÷ proteínas.
   - "$Y cada 1000 kcal" si hay 50 kcal o más cada 100. Cuenta: precio por kg × 100 ÷ kcal.
   Sin ninguna de las dos, no hay línea. Montos redondeados a pesos, con formato argentino.
3. **Fotos del envase.** En el pie: "Fotos del envase: frente · tabla · ingredientes", cada
   una un link (pestaña nueva) a la foto en OFF. Solo las que existen. Las fotos tienen
   licencia CC BY-SA: el pie ya nombra a Open Food Facts.
4. **% del valor diario.** Columna "%VD" a la derecha de "Por porción", solo si hay
   porción. Valores de referencia (Mercosur, dieta de 2000 kcal): energía 2000 kcal,
   carbohidratos 300 g, proteínas 75 g, grasas totales 55 g, grasas saturadas 22 g,
   fibra 25 g, sodio 2400 mg. Azúcares y grasas trans no tienen valor: celda vacía.
   Redondeado a entero, con "%". Debajo de la tabla: "%VD: con base en una dieta de
   2000 kcal".
5. **Calidad del dato.** En el pie: "Actualizado en marzo de 2026" (mes y año de
   `updatedAt`) y un link "Corregir en Open Food Facts" a la ficha del producto.
6. **Cargar desde el celular.** En "Sin información nutricional": un QR (SVG dibujado con
   nodos, sin `innerHTML` ni imágenes de afuera) con la URL de la ficha en OFF y el texto
   "Escaneá el código con el celular para cargarla con fotos del envase." Librería:
   `qrcode-generator` 2.0.4 (MIT, sin dependencias).
