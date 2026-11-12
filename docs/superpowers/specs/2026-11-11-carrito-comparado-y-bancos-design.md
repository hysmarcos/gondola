# Carrito comparado, elegir súper y bancos de los otros súper

Aprobado por el usuario el 2026-11-11. Contexto de producto: `PRODUCT.md`.
Base: `2026-11-09-v5-comparar-supermercados-design.md` (comparación por EAN, ya hecha).

## 0. Objetivo

1. En Ajustes se prende o apaga cada súper (Carrefour, Día, Más).
2. En el carrito se ve cuánto cuesta la misma compra en cada súper prendido, sin banco
   y con las tarjetas del usuario, y una respuesta arriba: dónde conviene comprar hoy.
3. Las tarjetas se eligen una sola vez y valen para Coto y para los otros súper.
4. Tres mejoras rápidas (sección 8).

Fuera de alcance:
- "Compra ahorradora" (recomendar otro producto más barato por kg o litro): segunda
  entrega, con su propio spec.
- Súper nuevos (Jumbo, Disco, Vea), promos de sucursal, costo de envío, cuotas.

## 1. Lo que se verificó (2026-11-11, en vivo)

- **Más** publica sus promos de banco como datos, sin login:
  `GET https://www.masonline.com.ar/_v/private/gdn-services/content/banks-promotions?_fields=…&_from=0&_to=99`.
  Campos: `title`, `sub_title`, `discount_percentage`, `discount_text_info`, `active`,
  `active_from`, `active_to`, `ecommerce`, `monday`…`sunday`, `idBank`, `legal`.
  Los bancos: `…/content/financing-banks?_fields=id,name`. Hoy: 45 promos, 2 con
  `ecommerce: true`. El tope va en `sub_title` ("Tope: $10.000 semanal"). Las exclusiones
  van en `legal` (rubros y marcas). Las promos online duran poco, a veces un día.
- **Carrefour** muestra en `https://www.carrefour.com.ar/descuentos-bancarios` cada promo
  con porcentaje, título, texto corto con tope y exclusiones, legal completo y formato de
  tienda (incluye online). El componente (`valtech.carrefourar-bank-promotions`) usa los
  mismos campos que Más (entidad `BP`). La página no pidió datos aparte al cargar: los
  datos viajan en el HTML. No se probó leerlos desde fuera del navegador.
- **Día** trae en el HTML de `https://diaonline.supermercadosdia.com.ar/medios-de-pago-y-promociones`
  una lista `cards` con `__editorItemTitle`, `active`, `daysToShow`, `availableOn.online`,
  `associatedBanks` y `terms` (texto legal). Porcentaje y tope no son campos: están en el
  título ("Naranja 20%") o en `terms`. Hoy: unas 12 promos activas y online. Casi no
  excluye productos; sí pone compra mínima y tope.
- La simulación de carrito de VTEX (`/api/checkout/pub/orderForms/simulation`) acepta
  varios productos en un solo pedido.

## 2. Decisiones del usuario

- El carrito compara **solo los productos que están en los dos súper**.
- Solo Carrefour, Día y Más, cada uno con su interruptor.
- Los bancos de los otros súper entran en esta entrega. **Solo promos de compra online.**
- Las exclusiones se escriben **a mano** leyendo los términos de cada súper, con una
  **alarma**: si el súper cambia el texto, esa promo no se resta.
- Las tarjetas **no se separan por súper**. El plan (Naranja X, ICBC) se elige una vez.

## 3. Elegir súper

- Clave nueva `storesOff: string[]` en `chrome.storage.local` (por defecto `[]`: todos
  prendidos). `compareStores` sigue siendo el interruptor general.
- Popup, Ajustes, sección "Comparar y nutrición": debajo de "Comparar con otros súper",
  una fila con interruptor por cada súper de `stores.js`. Con el general apagado, las
  filas se ven apagadas y no se pueden tocar.
- `bridge.js` manda `stores: string[]` (ids prendidos). `badge.js` y `cart-ui.js` mandan
  esa lista en cada mensaje al service worker. `compare-service.js` solo consulta esos
  súper. Un súper apagado no se consulta y no se pinta en ningún lado.

## 4. Tarjetas: una sola lista

### Modelo

- `src/cards.js`: lista fija de tarjetas `{ id, name, plans: [{ id, name }] }`.
  Ejemplo: `{ id: "naranjax", name: "Naranja X", plans: [inicial, turbo, epico] }`.
  Una tarjeta sin planes tiene `plans: []`. Incluye billeteras (MODO, Mercado Pago).
- Clave nueva `cards: { [cardId]: { plan: string | null } }`. Estar en el objeto =
  prendida.
- Cada promo, de Coto o de otro súper, se asigna a `{ cardId, plan | null }` con las
  reglas de la sección 5. `plan: null` en la promo = vale para cualquier plan.
- Una promo aplica al usuario si su tarjeta está prendida y (`promo.plan` es `null` o
  igual al plan elegido).

### Coto

- `bridge.js` arma `selected` con las promos de Coto que aplican según `cards`.
  `interceptor.js` y `cart.js` no cambian.
- Migración, una sola vez: si existe `selectedPromoIds` y no existe `cards`, cada promo
  elegida prende su tarjeta y su plan. Después se usa solo `cards`.
- Comunidad Coto sigue aparte (ajuste "Tengo Comunidad Coto").

### Pantalla

- Pestaña Tarjetas: el día de compra y el buscador quedan igual. Una fila por tarjeta
  con interruptor. Primero las prendidas, después por nombre.
- Tarjeta prendida con planes: chips para elegir uno (radio). Sin plan elegido, solo
  cuentan las promos con `plan: null`.
- Debajo de cada tarjeta prendida, una línea por súper (Coto y los prendidos): día,
  porcentaje y tope del plan elegido; "sin promo online" si no hay; o el estado de la
  promo (sección 5) con enlace a la página de promos del súper.
- `cardsView` sale de `popup.js` a `src/popup-cards.js` (el archivo ya es grande).

## 5. Promos de banco de los otros súper

### Piezas

- `src/bank-promos/mas.js`, `carrefour.js`, `dia.js`: funciones puras
  `parse(texto o json) → Promo[]`. Forma común:
  `{ id, store, bankLabel, title, percent, cap, capPeriod, minPurchase, days, from, to, online, direct, legal }`.
  `percent`, `cap` y `minPurchase` son `null` si no se leen con certeza. `direct` =
  descuento en el acto (no reintegro).
- `src/bank-promos/service.js` (service worker): mensaje `{ type: "bankPromos", stores }`
  → `{ [storeId]: Promo[] | "error" }`. Baja las promos una vez por día por súper
  (memoria `bankPromosCache`, 24 h, con `createPriceCache`). Devuelve solo las `online`,
  activas y dentro de fecha. Pedidos sin cookies (`credentials: "omit"`), 8 s máximo.
- `src/bank-rules/coto.js`, `mas.js`, `carrefour.js`, `dia.js`: reglas a mano.
  - `cardOf(promo) → { cardId, plan } | null`.
  - `exclusions: [{ hash, test(producto) → boolean }]`: una entrada por texto de
    exclusiones ya leído. `producto` son los datos de Coto (nombre, marca, grupos) más
    `onSale` (si en el otro súper está en oferta). Mismo estilo que `exclusions.js`.
  - Cada archivo dice la fuente y la fecha de lectura.
- `src/bank-rules/hash.js`: `exclusionText(legal)` junta las oraciones del legal que
  hablan de exclusiones (`EXCLU`, `NO INCLUYE`, `NO APLICA SOBRE`, `NO ACUMULABLE`), en
  mayúsculas, sin acentos y con espacios simples. `hashOf(texto)` da la huella. Las
  fechas quedan afuera, así un cambio de mes no dispara la alarma.

### Estado de una promo

`statusOf(promo, rules)`:
- `"ok"`: tiene tarjeta, `percent` y su huella de exclusiones está en las reglas.
- `"unmapped"`: no se sabe de qué tarjeta es. Va al final de Tarjetas, en "Otras promos".
- `"unclear"`: sin `percent` (por ejemplo, solo cuotas).
- `"changed"`: la huella no está en las reglas. Texto: "Los términos cambiaron".

**Solo `"ok"` se resta de un total.** Las demás se muestran con enlace al súper.
En Más la alarma va a saltar seguido, porque sus promos online cambian a diario. Es lo
esperado: se ve la promo, no se resta.

### Fuente de Carrefour

El plan de implementación empieza por una captura (`scripts/capture-bank-fixtures.mjs`)
que guarda el HTML real y fija de qué parte se leen los datos. Si desde el service
worker no se pueden leer, Carrefour queda sin promos de banco ("No pudimos leer las
promos de Carrefour") y el resto de la entrega no cambia.

## 6. Carrito comparado

### Precios

- Mensaje nuevo `{ type: "cartCompare", items: [{ ean, qty }], stores }`.
- Por súper: una búsqueda por EAN (hasta 50 por consulta, como hoy) y **una sola
  simulación** con todo el carrito y las cantidades reales. El súper calcula sus promos
  por cantidad. Respuesta por producto: `{ total, onSale, url } | "missing"`, o `"error"`
  para todo el súper.
- Sin memoria: solo se comparten los pedidos iguales en vuelo. `cart-ui.js` espera
  800 ms sin cambios en el carrito antes de pedir. "Actualizar" pide de nuevo.

### Cuenta (`src/cart-compare.js`, puro)

Entrada: líneas del análisis de `cart.js`, respuesta de `cartCompare`, promos de cada
súper, `cards`, día de compra. Por súper:

- **Faltante**: sin EAN, pesable, `"missing"`, sin stock, o precio por unidad fuera de
  `[0.4, 2.5]` veces el de Coto (dato dudoso). El faltante sale de los dos lados.
- `matched`: cuántos productos quedan. `totalCoto` y `totalOther`: suma de esos
  productos, con promos de cada súper, **sin banco**.
- **Con tarjetas**, de cada lado, sobre los mismos productos:
  - Coto: la mejor promo del día con las reglas de hoy (`cart.js`).
  - Otro súper: la mejor promo `"ok"` del día para las tarjetas del usuario.
    `ahorro = min(elegible × percent, cap)`. `elegible` deja afuera los excluidos. Si
    `totalOther < minPurchase`, no aplica y se guarda cuánto falta.
- **Respuesta de arriba** (`verdict`): compiten Coto y los súper cuyo `totalCoto` es al
  menos la mitad del total del carrito en Coto. Se compara con tarjetas si hay alguna
  prendida; si no, sin banco. Tolerancia de 1%. Sin súper que compitan: no hay respuesta
  y se dice "Pocos productos en común para comparar".

### Pantalla (`src/cart-compare-ui.js`)

- **/carrito**: bloque "Tu carrito en otros súper", debajo del resumen de totales.
  - Arriba: "Hoy te conviene Coto" o "Hoy te conviene Día", con la diferencia en pesos.
  - Un bloque por súper: nombre, "9 de 12 productos", ▼ "$3.150 menos" o ▲ "$1.200 más"
    (mismos colores e íconos que la comparación de hoy).
  - Renglón "Sin banco": total del súper y total de Coto.
  - Renglón "Con tus tarjetas (Naranja X 25%)": los dos totales. Si no aplica: "Sin
    promo de tus tarjetas hoy", "Te faltan $X para la compra mínima" o "Los términos
    cambiaron", según el caso.
  - "Faltan 3: ver cuáles" abre la lista de faltantes.
  - Pie: "Precios online de hace N min, sin envío" y el botón "Actualizar".
- **Mini-carrito**: una sola línea, sin cambiar el tamaño del desplegable: la respuesta
  de arriba en corto ("Día: $3.150 menos en 9 de 12"). Tocarla lleva a /carrito.
- Solo agrega nodos. No toca nodos de Coto.

## 7. Errores y casos raros

- Súper caído o tiempo agotado: su bloque dice "No pudimos consultar Día". No compite.
- Todos los súper apagados o el interruptor general apagado: el bloque no se pinta.
- Carrito vacío o sin ningún producto con EAN: el bloque no se pinta.
- Promos de banco de un súper con error: el renglón con tarjetas dice "No pudimos leer
  las promos" y la respuesta de arriba usa los precios sin banco para ese súper.
- El service worker puede dormirse: todo lo que dura vive en `chrome.storage.local`.

## 8. Mejoras rápidas

1. En la lista de productos comunes y faltantes del bloque del carrito, cada producto
   que está en el otro súper lleva "Ver en Día" (el enlace que ya trae la búsqueda).
2. Antigüedad de los precios y botón "Actualizar" (sección 6).
3. En Ajustes, al lado del interruptor de un súper que dio error en la última consulta:
   "No responde". Se guarda en `storeStatus` y se borra cuando vuelve a responder.

## 9. Permisos y textos

- `manifest.json`: sin permisos nuevos (los tres hosts ya están). Versión `0.15.0`.
- Popup, Ayuda: "Las promos de otros súper son solo de compra online. Los totales no
  incluyen envío. Si los términos de una promo cambiaron, no se resta."
- `PRODUCT.md`, `site/privacidad.html` y la ficha de la tienda: además de códigos de
  barras, se mandan las cantidades del carrito a Carrefour, Día y Más para simular la
  compra, y se leen sus páginas públicas de promos. Sin cookies, sin datos personales.

## 10. Pruebas

- `scripts/capture-bank-fixtures.mjs`: respuestas reales de promos de los tres súper en
  `tests/fixtures/bank-*.json` / `.html`, y una simulación de carrito con varios productos.
- `vitest`:
  - `bank-promos/*`: cada parser con su captura (porcentaje, tope, días, online, fechas,
    promo sin número).
  - `bank-rules/*`: `cardOf`, exclusiones, huella estable ante cambio de fechas, huella
    distinta ante cambio de exclusiones.
  - `statusOf`: los cuatro estados.
  - `cards`: migración desde `selectedPromoIds`, plan elegido, promo sin plan.
  - `cart-compare`: faltantes (sin EAN, pesable, sin stock, dato dudoso), totales, tope,
    compra mínima, exclusiones, respuesta de arriba (Coto gana, otro gana, empate de 1%,
    menos de la mitad del carrito, sin tarjetas).
  - `cart-compare-ui` y `popup-cards`: lo que se pinta en cada caso de la sección 6 y 4.
  - `compare-service`: `stores` filtra, `cartCompare` hace una simulación por súper.
- Prueba manual: cargar la extensión, armar un carrito en coto.com.ar, prender y apagar
  súper, elegir tarjetas y plan, y revisar que Coto sigue funcionando igual.
