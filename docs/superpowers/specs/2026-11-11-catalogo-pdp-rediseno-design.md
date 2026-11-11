# Rediseño del catálogo y de la página de producto ("piel Góndola")

Aprobado por el usuario el 2026-11-11. Contexto de producto: `PRODUCT.md`.
Mockup aprobado: `docs/superpowers/specs/2026-11-11-catalogo-pdp-rediseno-mockup.html`
(abrirlo en el navegador; se puede tocar). Si este texto y el mockup no coinciden, vale el
texto.

## 0. Objetivo y alcance

Góndola le pone un diseño nuevo a dos páginas de coto.com.ar: la lista de productos
(categoría, búsqueda, ofertas) y la página de producto (PDP). Es solo diseño. Todo lo que
hace Coto sigue andando igual: agregar al carrito, sumar y restar cantidad, filtrar,
ordenar, paginar, la nota del pedido, las cuotas.

Entra:

- Lista: tarjeta, grilla, columna de filtros, subcategorías, barra de orden.
- PDP: galería, caja de compra, información nutricional, descripción y características.
- Un interruptor en el popup para apagar el diseño nuevo.

No entra:

- Encabezado, menú principal, pie, carruseles, mini-carrito y `/carrito`.
- Cálculos nuevos. Precio por unidad, bancos, comparador y nutrición usan lo que ya existe.
  Única excepción de datos: las etiquetas "para vos" de la tarjeta piden la ficha de Open
  Food Facts de los productos que se ven en pantalla (sección 4.2).
- Octógonos (Ley 27.642): siguen fuera, por el motivo del spec de nutrición.
- Calorías en la tarjeta de la lista: cargan la tarjeta. Quedan en la PDP.
- Vista de lista tipo planilla y vista "etiqueta" en la tarjeta (variantes 2 y 3,
  descartadas).

## 1. Decisiones aprobadas

1. **Look nuevo**, no un retoque del look de Coto.
2. **Lista completa**: tarjeta, grilla, filtros y barra de orden.
3. **Base neutra, rojo solo para comprar.** Fondo blanco y texto casi negro. Rojo Coto en
   "Agregar", el selector de cantidad y las ofertas de Coto. Azul y ámbar de Góndola en lo
   que agrega Góndola.
4. **Variante 1, "Estante"**, para la lista y la PDP.
5. **Nutrición y descripción de la PDP con estilo "etiqueta"** (variante 3): tabla como la
   del envase y ficha de casilleros.
6. **Filas parejas**: cada parte de la tarjeta tiene un alto fijo.

## 2. Reglas para no romper Coto

Estas reglas valen más que cualquier detalle visual de este documento.

1. Góndola no borra, no clona y no reemplaza nodos de Coto. Los controles que el usuario
   toca ("Agregar", `−`, `+`, el campo de cantidad, los links de filtro, el selector de
   orden, la paginación, la nota del pedido, "Ver planes de cuotas") son los nodos de Coto,
   con otro estilo.
2. Góndola no mueve esos controles a otro padre. El orden visual se cambia con CSS (`order`,
   grilla, `position`), no reubicando nodos. Motivo: Coto es una aplicación Angular y un
   nodo movido puede perder sus eventos o volver a dibujarse.
3. Lo que sobra se oculta con el atributo `data-coto-unit-hide`, como hoy.
4. Los nodos propios de Góndola (precio por unidad, comparador, etiquetas, nutrición) sí se
   pueden crear y mover.
5. Todo el diseño nuevo cuelga de un atributo en `<html>`: `data-gondola-skin`. Sin el
   atributo, la página se ve como en la versión 0.12.0.
6. Si en una página falta un nodo que el diseño necesita, Góndola saca el atributo en esa
   página y deja el aspecto de la 0.12.0. No se muestra un diseño a medias. Mientras la
   página todavía no se dibujó (Coto la arma después de cargar), el atributo queda puesto.

## 3. Sistema visual

| Uso | Valor |
|---|---|
| Texto | `#16181d` |
| Texto secundario | `#5b616e` |
| Línea | `#e6e8ec` |
| Fondo suave (foto, casilleros) | `#f5f6f8` |
| Rojo Coto (comprar, ofertas) | `#e20025`, al pasar el mouse `#c4001f` |
| Azul Góndola (precio por unidad, banco) | `#14284b`, suave `#eef2f9` |
| Ámbar Góndola (más barato, avisos) | `#ffc233`, suave `#fff4d1` con texto `#6b4a00` |
| Verde (Coto gana, Sin TACC) | `#0a7a3d`, suave `#e6f4ec` |

- Tipografía: Poppins 400, 500 y 600 (ya está en `assets/fonts/`). Texto base 13 px, mínimo
  12 px. Etiquetas 11 px. Precio de tarjeta 20 px. Precio de PDP 32 px.
- Números con `font-variant-numeric: tabular-nums`.
- Radios: tarjeta 14 px, foto 8 px, botón 10 px, etiqueta 6 px, caja de compra 16 px.
- Bordes con `box-shadow: 0 0 0 1px` en lugar de `border`, para no cambiar medidas.
- Contraste mínimo 4,5:1 en texto (WCAG 1.4.3). Revisar el precio tachado y las etiquetas.

## 4. Lista de productos

### 4.1 Página

- Dos columnas: filtros a la izquierda (184 px, fijos al bajar con `position: sticky`) y
  productos a la derecha.
- Arriba de los productos: título de la categoría con la cantidad de productos, y a la
  derecha el selector de orden de Coto (`.plp-header__sort`) con estilo nuevo.
- Subcategorías como una fila de chips, separadas del resto de los filtros.
- Filtros aplicados: una fila con un chip por filtro activo y "Borrar todo". Solo se
  muestra si Coto ya trae esos links; Góndola no arma URLs de filtro propias.
- Filtros: grupos con título, casilla y cantidad. Son los links de Coto. La casilla es
  dibujo (un `::before`); el click sigue siendo el del link.
- Grilla: 4 columnas desde 1100 px de ancho de ventana, 3 columnas por debajo. Separación
  de 12 px.
- El banner publicitario de arriba de la lista no se toca.

### 4.2 Tarjeta

La tarjeta es una columna. Cada parte tiene alto fijo, haya dato o no. Lo que no entra se
corta con "…".

| Orden | Parte | Alto | Contenido |
|---|---|---|---|
| 1 | Foto | cuadrada | Fondo suave. Arriba a la izquierda, una etiqueta: "Más barato por litro" (ámbar), o la oferta de Coto (roja), o "Sin stock". Abajo, las etiquetas "para vos". |
| 2 | Nombre | 36 px | 2 líneas. |
| 3 | Precio | 28 px | Precio final de 20 px y, al lado, el precio regular tachado. |
| 4 | Precio por unidad | 20 px | Azul. Valor, unidad y motivo ("llevando 2", "con ICBC hoy"). Vacío si no hay dato. |
| 5 | Comparador | 33 px | Una línea, con una línea fina arriba. |
| 6 | Acción | 40 px | "Agregar" o el selector de cantidad de Coto. |

Reglas de cada parte:

- **Etiqueta de arriba**: una sola entre "más barato de la categoría" y la oferta de Coto,
  en ese orden de prioridad. La marca de inicio de grupo al ordenar por unidad ("▸ Por
  litro") se sigue viendo, debajo.
- **Etiquetas "para vos"**: máximo 2, en una fila. Flotan sobre la foto, así que no cambian
  el alto. Solo para alergias y celíaco: "Tiene leche", "Puede tener soja", "Sin TACC",
  "Revisá TACC". Sodio y azúcar no generan etiqueta en la tarjeta (sería calcular un
  sello); siguen en la PDP. Sin perfil, no hay etiquetas.
  - Dato nuevo: hoy la nutrición se pide solo en la PDP. Con celíaco o alguna alergia en el
    perfil, Góndola pide a Open Food Facts cada producto de comida cuando su tarjeta entra
    en pantalla. Viaja solo el código de barras, se guarda 7 días y un error no se
    reintenta en la misma página.
- **Precio y precio por unidad**: son los mismos valores de hoy (`bankValue ?? value`). El
  banco no agrega una línea: aparece como motivo, con el nombre del banco sobre fondo azul.
- **Comparador**: es la pastilla que ya dibuja `compare-ui.js`, a lo ancho de su fila y
  sin fondo, con sus textos de hoy: "Mejor precio" (verde), "Más barato en Más" (ámbar),
  "Igual", "Comparando…" y "Sin comparar" (gris). Al hacer click se abre el panel de hoy
  con Coto y los tres súper. El panel flota sobre la tarjeta y no mueve nada. El mockup
  muestra otros textos y barras; vale este texto.
- **En el carrito**: borde rojo de 2 px en la tarjeta y el selector de cantidad en lugar de
  "Agregar".
- **Sin stock**: foto atenuada y el botón de Coto deshabilitado. El precio y el comparador
  se siguen viendo.

Se ocultan las mismas partes de Coto que hoy (`.descuentos-slot`, `h4.card-title`, "Precio
Regular", "Precio por 1 …", el banner de Comunidad) y además "Ver planes de cuotas" en la
tarjeta: sigue en la PDP.

"Precio sin impuestos nacionales" no se oculta: es una séptima parte, debajo del botón, de
18 px de alto, en 12 px y gris. El mockup no la muestra; vale este texto.

### 4.3 Por qué alto fijo y no subgrid

En la tarjeta de Coto, el precio y el botón viven en cajas distintas (`.centro-precios` y
`.bottom-botones`). Un subgrid de CSS necesita que las partes sean hijas directas de la
grilla, así que dependería de cómo Coto arma su HTML. El alto fijo no depende de eso. El
subgrid queda como alternativa si en el futuro hace falta texto de alto variable.

## 5. Página de producto

### 5.1 Estructura

Dos columnas: contenido a la izquierda y caja de compra a la derecha (380 px), fija al
bajar. Por debajo de 820 px de ancho, una sola columna con la caja de compra primero.

Columna izquierda, en orden:

1. Galería: miniaturas en columna (56 px) y foto grande. Las fotos del envase de Open Food
   Facts siguen como hoy, con borde ámbar en la miniatura.
2. Información nutricional.
3. Descripción y características.

### 5.2 Caja de compra

En orden:

1. Nombre del producto (20 px) y, debajo, marca y contenido.
2. Oferta de Coto como etiqueta roja.
3. Precio final (32 px) con el regular tachado al lado.
4. Precio por unidad con su motivo.
5. "Agregar" o el selector de cantidad de Coto.
6. **Con tu banco**, con las reglas reales de Coto (un producto en oferta no suma banco):
   - El banco aplica: "ICBC hoy: 10% · $1.816,20". El precio grande ya es ese.
   - No aplica: "Banco no aplica: ya está en oferta" o "…excluido de promos".
   - Sin tarjetas elegidas: "Elegí tus tarjetas en el botón de Góndola y vas a ver el
     precio con el descuento de cada día."
   - Con tarjetas pero sin promo para este producto: no se muestra el bloque.
   No hay link "Cambiar": una página no puede abrir el popup de la extensión. El mockup
   muestra un caso "banco contra llevando 2" que no existe; vale este texto.
7. **El mismo producto en otros súper**: las filas que ya dibuja `compare-ui.js`, una por
   súper, con nombre y precio. La más barata en verde. Cada fila abre la página de ese
   súper. Sin barras de proporción.
8. "Ver planes de cuotas" (link de Coto).
9. "Agregar una nota o un reemplazo": el formulario de Coto ("Instrucciones para armar el
   pedido"), plegado. Si el formulario ya tiene texto guardado, arranca abierto.
10. "Precio sin impuestos nacionales", en 12 px.

Las secciones 6 y 7 se separan con una línea fina, sin cajas de color (evita tarjetas
dentro de tarjetas).

### 5.3 Información nutricional (estilo "etiqueta")

- Arriba: etiquetas "Para vos" (si hay perfil) y el rinde por proteína (si aplica).
- Izquierda (300 px): la tabla como la del envase. Borde negro de 2 px, título, línea de
  envase y porciones, barra negra gruesa, y filas con línea negra. Un interruptor "Cada
  100 g/ml" / "Por porción" cambia las columnas. Al pie, la nota de %VD.
- Derecha: cuatro números grandes (calorías, proteínas, azúcares, sodio), que siguen al
  interruptor. Debajo: alérgenos, Sin TACC, procesamiento (NOVA) e ingredientes plegados.
  Al final, la fuente y los links de Open Food Facts.
- Por debajo de 1100 px, la tabla y el resto van uno debajo del otro.

Estados:

| Caso | Qué se ve |
|---|---|
| Sin tabla en Open Food Facts | Un recuadro de línea punteada: "Todavía no hay tabla" y el link para cargarla. |
| Tabla parcial | La tabla con las filas que hay. Los números grandes que falten no se muestran. |
| Sin perfil | Sin etiquetas "Para vos". Lo demás igual. |
| Aviso de TACC (`warn`) | Etiqueta ámbar "Revisá el envase" con el texto de `taccStatus`. |
| No es comida | La sección no aparece, como hoy. |

### 5.4 Descripción y características

- La descripción de Coto, en texto de 14 px y hasta 60 caracteres por línea.
- Las características de Coto como una ficha: tabla con barra negra arriba, una fila por
  dato (marca, contenido, Sin TACC, PLU y EAN) y línea negra entre filas.

## 6. Movimiento y accesibilidad

- Botones: `transform: scale(0.97)` al apretar, 160 ms, curva
  `cubic-bezier(0.23, 1, 0.32, 1)`.
- "Agregar" → selector de cantidad: 200 ms, opacidad y un desenfoque leve. No cambia el
  alto de la tarjeta.
- Panel del comparador: 150 ms, opacidad y escala desde 0,97, con origen en la línea que lo
  abre.
- Tarjeta al pasar el mouse: sombra suave, solo con `@media (hover: hover) and (pointer: fine)`.
- Nada se anima al cargar la página.
- Nunca `transition: all`. Solo `transform`, `opacity`, `box-shadow` y `background-color`.
- Con `prefers-reduced-motion: reduce` quedan solo los cambios de color.
- Zona de toque mínima de 40 × 40 px en `−` y `+` (WCAG 2.5.8 pide 24).
- Los títulos siguen el orden h1, h2, h3 sin saltos. Las tablas son `<table>` reales.

## 7. Interruptor y texto de producto

- Ajuste nuevo `skin` en `chrome.storage.local`, encendido por defecto. Apagado: se saca
  `data-gondola-skin` y la página se ve como en la 0.12.0, con todas las funciones.
- En el popup: título "Diseño Góndola", texto "Diseño nuevo en la lista de productos y en
  la página de producto. Apagalo para ver el de Coto."
- `PRODUCT.md` cambia en dos lugares, porque hoy dice que las páginas de Coto mantienen su
  aspecto:
  - "Name": las páginas de Coto usan la piel Góndola en la lista y la PDP; se puede apagar.
  - "Brand Commitments": base neutra; rojo Coto solo en comprar y ofertas; azul y ámbar
    para lo que agrega Góndola.

## 8. Cómo se arma

| Unidad | Qué hace | Depende de |
|---|---|---|
| `src/skin-dom.js` | Mapa de selectores de Coto para la lista y la PDP, sacado del HTML real. | nada |
| `src/skin.js` | Lee el ajuste `skin`, pone o saca `data-gondola-skin` en `<html>` (`"list"` o `"pdp"`) y revisa que estén los nodos que el diseño necesita (regla 2.6). | `chrome.storage`, `skin-dom.js` |
| `src/skin.css` | Tokens (sección 3) y piezas comunes: botón, selector de cantidad, etiquetas. | nada |
| `src/skin-list.css` | Lista: página, filtros, grilla y tarjeta. | `skin.css` |
| `src/skin-pdp.css` | PDP: galería, caja de compra, nutrición, ficha. | `skin.css` |
| `src/badge.js` | Sigue pintando los nodos de Góndola. Suma la línea de comparador de la tarjeta, las etiquetas sobre la foto y el plegado de la nota del pedido. | lo de hoy |
| `src/nutrition-ui.js` | Suma el interruptor "100 g/ml / porción" y los cuatro números grandes. | lo de hoy |
| `src/popup.js` | Suma el interruptor del diseño. | `chrome.storage` |

- Todas las reglas de los archivos `skin-*.css` empiezan con `[data-gondola-skin]`.
- `src/badge.css` no cambia de comportamiento: es el aspecto con la piel apagada.
- `manifest.json` suma los tres CSS a `content_scripts`.

## 9. Pruebas

Automáticas (Vitest con jsdom):

- `skin.js`: pone el atributo con el ajuste encendido, lo saca con el ajuste apagado y lo
  saca si falta un nodo necesario.
- Tarjeta: una etiqueta arriba según la prioridad; máximo 2 etiquetas "para vos"; los
  cuatro estados del comparador; el lugar del precio por unidad existe aunque esté vacío.
- Nutrición: el interruptor cambia tabla y números; los estados de la tabla 5.3.
- Los tests actuales siguen pasando sin cambios.

Manuales, en coto.com.ar, con la piel encendida y apagada:

1. Lista: agregar un producto, sumar, restar hasta cero. El mini-carrito y el total
   coinciden.
2. Lista: aplicar un filtro, sacar un filtro, cambiar el orden, pasar de página.
3. Lista: los botones y los precios quedan alineados en cada fila, a 1280 y 1920 px.
4. PDP: agregar, sumar, restar. Guardar y borrar una nota del pedido. Abrir las cuotas.
5. PDP: la caja de compra queda fija al bajar y no tapa el pie.
6. Búsqueda y página de ofertas: mismas pruebas que la lista.
7. `npm run audit` no reporta diferencias de precio.

## 10. A confirmar al implementar

Este diseño se hizo con capturas y con los selectores que la extensión ya usa. No se
inspeccionó el HTML real de estas partes:

- La columna de filtros, las subcategorías y los filtros aplicados.
- El contenedor de la grilla (cuántos nodos hay entre la grilla y `.card-container`).
- La columna derecha de la PDP y el formulario de la nota del pedido.

El primer paso del plan es capturar ese HTML. Si una parte no se puede lograr sin mover
nodos de Coto, se simplifica el diseño de esa parte; la regla 2 no se negocia.

## 11. Evidencia usada

Páginas abiertas y leídas el 2026-11-11:

- El botón "Agregar" se vuelve selector de cantidad, y la cantidad es editable:
  [Baymard](https://baymard.com/blog/grocery-add-to-cart-buttons),
  [NN/g](https://www.nngroup.com/articles/food-shopping-covid19/).
- Resaltar los productos que ya están en el carrito:
  [Baymard](https://baymard.com/blog/highlight-products-if-in-users-cart).
- Los mismos atributos en cada tarjeta y bien diferenciados:
  [Baymard](https://baymard.com/blog/list-item-design-ecommerce).
- Precio por unidad al lado del precio total, con la unidad escrita:
  [Baymard](https://baymard.com/blog/price-per-unit).
- La oferta va pegada al precio:
  [NN/g](https://www.nngroup.com/articles/communicating-discounts/),
  [Baymard](https://baymard.com/research-articles/product-page-price-discounts).
- Subcategorías separadas de los demás filtros:
  [NN/g](https://www.nngroup.com/articles/ecommerce-homepages-listing-pages/).
- Filtros fijos y resumen de producto fijo en escritorio:
  [Baymard](https://baymard.com/blog/responsive-upscaling).
- Resaltar el precio por unidad hace que se mire más, pero no cambió la elección
  (Bogomolova et al., 2020, resumen):
  [Journal of Business Research](https://ideas.repec.org/a/eee/jbrese/v111y2020icp102-116.html).
- Tamaño de toque, contraste y movimiento:
  [WCAG 2.5.8](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html),
  [1.4.3](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html),
  [2.3.3](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html).

No se pudo verificar cómo lo hacen hoy Ocado, Tesco, Mercadona, Carrefour, Jumbo o Rappi:
sus sitios bloquearon la lectura. Este diseño no se apoya en ellos.

Skills de diseño aplicadas: `impeccable` (modo Operate: precisión y patrones conocidos),
`make-interfaces-feel-better` (números de ancho fijo, sombras en lugar de bordes, escala al
apretar, sin `transition: all`, zona de toque) y `emil-design-eng` (curvas y duraciones,
origen del panel, nada animado al cargar, movimiento reducido).
