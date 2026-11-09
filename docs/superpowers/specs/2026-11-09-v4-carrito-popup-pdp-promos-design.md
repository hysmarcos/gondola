# v4: mini-carrito vivo, popup con menús, PDP y promos NxM

Aprobado por el usuario el 2026-11-09. Contexto de producto: `PRODUCT.md`.

## 1. Mini-carrito que se actualiza

Causa: `onCart` solo analiza en `/carrito` o durante 5 s después de abrir el mini-carrito.
Si se agrega con el mini-carrito abierto o más tarde, la respuesta nueva de `getCarrito` se ignora.

Cambio en `src/interceptor.js`: `cartWanted` pasa a `true` la primera vez que llega un
`cartRequest` (se abrió el mini-carrito o se entró a `/carrito`) o que pasa un
`addOrRemoveItemToOrderV2`. Desde ahí, toda respuesta de `getCarrito` se analiza
(las búsquedas por PLU tienen caché de 5 min, solo cuestan productos nuevos).
`FORCE_CART_MS` desaparece.

## 2. Popup con menús

- Tres pestañas abajo: **Tarjetas**, **Ajustes**, **Ayuda**. Router simple por `data-view`;
  la pestaña elegida se recuerda en `chrome.storage.local` (`popupTab`).
- Mundo visual pegado a Coto: Poppins (empaquetada, `assets/fonts/`, licencia OFL),
  rojo Coto `#B01F17` (botones) y `#E20025` (acentos), texto `#212529` / `#51585E`,
  botones y chips tipo píldora. Encabezado con nombre de la extensión, sin logo de Coto,
  y la línea "No afiliado a Coto" en Ayuda.
- **Tarjetas**: día de compra con chips (Hoy, Dom…Sáb); buscador de banco; bancos como
  filas desplegables con contador de promos elegidas; cada promo con interruptor y texto
  "Mié · 25% · tope $10.000 por semana". Estado vacío: "Abrí coto.com.ar una vez para
  cargar las promos".
- **Ajustes** (interruptores, guardados en storage): `autoPromo` "Completar promos 2x1, 3x2"
  (default on), `notifyPromo` "Avisar promos por cantidad" (on), `markBest` "Marcar el más
  barato" (on).
- **Ayuda**: qué hace cada etiqueta, cómo se calcula, "No afiliado a Coto", versión.
- Estados: foco visible, hover, `prefers-reduced-motion`, números con `tabular-nums`,
  área táctil ≥ 40 px.

## 3. Página de producto (PDP) y carrusel

- La caja "Precio real para comparar" va a lo ancho, debajo del bloque de precio de Coto
  (después del `div` que contiene `var.price` y la oferta, dentro de `.mt-4`), no dentro de
  `div.mb-1`. Las líneas secundarias de Coto (Precio regular, sin impuestos, Precio por 1 …)
  se atenúan igual que en las tarjetas.
- Carrusel "También te pueden interesar" (`mini-product-card`, sin links): las etiquetas
  de `recommendations` también se indexan por `data.id` (`prod00632358`). La tarjeta se
  busca por `data-cnstrc-item-id` y lleva una caja compacta (solo el valor) después de
  `.mini-product-card__price-section`; `__reference-price` se atenúa.
- Papel higiénico sin metros en el nombre pero con formato m²: metros = m² × 10
  (rollo de 10 cm), etiqueta $/10 m con la nota "≈ ancho 10 cm".

## 4. Promos NxM automáticas

- Se parsea `discountText` `/^(\d+)x(\d+)$/` → `{n, m}` (2x1, 3x2, 6x4, 6x5, 8x7).
- Regla: al subir la cantidad (nueva > anterior), si `nueva % n === m` se suma `n − m`.
  2x1: 1→2, 3→4. 3x2: 1 queda (aviso), 2→3. 6x4: 4→6. Bajar nunca se toca.
- Implementación: el intermediario (mundo MAIN) parchea `send` para el POST a
  `addOrRemoveItemToOrderV2`, lee el JSON `{skuId, quantity, prodId, ...}` y reescribe
  `quantity` antes de enviarlo. Una sola petición, ya con la cantidad final.
- Cantidad anterior: la del último `getCarrito` visto, pisada por la última cantidad
  enviada por nosotros (para clics rápidos antes del refresco).
- Promo del producto: mapa `prodId → data` alimentado por todas las respuestas de
  productos vistas. Si no está, se espera la búsqueda por PLU (tope 1,5 s) y si falla se
  envía sin cambios.
- Pantalla: el intermediario publica `{type: "promoAdjust", prodId, quantity, text}`;
  la parte visual pone el número nuevo en el contador visible al instante y muestra un
  aviso breve ("2x1: agregamos el segundo gratis"). Para promos que no son NxM
  ("70% 2da", "Llevando 12") o NxM sin completar (3x2 con 1) solo aviso, si `notifyPromo`.
- `autoPromo` apagado: no se reescribe nada.

## Pruebas

Unitarias (Vitest + jsdom) para: regla NxM, reescritura del body, `cartWanted`, índice por
`data.id`, metros desde m², ubicación PDP, carrusel, popup (pestañas, ajustes, búsqueda).
En vivo en coto.com.ar con sesión iniciada: agregar un 2x1 y un 3x2, ver el mini-carrito
actualizarse, quitar los productos al final.
