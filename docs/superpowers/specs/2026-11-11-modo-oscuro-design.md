# Modo oscuro en el sitio de Coto: diseño

Fecha: 2026-11-11. Estado: aprobado por secciones en el brainstorming; falta la lectura final.

## Objetivo

Góndola suma un modo oscuro para todo coto.com.ar. El usuario lo elige desde el popup. El
cambio entre claro y oscuro se anima con una onda. El logo de Coto pasa de rojo a negro. La
paleta sigue buenas prácticas de modo oscuro.

## Decisiones tomadas

| Tema | Decisión |
| --- | --- |
| Alcance | Todo el sitio: encabezado, inicio, lista, producto, mini carrito, /carrito, pie, menús y ventanas. |
| Selector | Tres opciones: Claro, Oscuro, Automático. Valor inicial: Claro. |
| Logo | La imagen original de Coto con un filtro CSS: el rojo pasa a negro, el blanco queda blanco. No se reemplaza por texto ni por otra imagen. |
| Transición | Onda: un círculo crece desde la esquina de arriba a la derecha. |
| Técnica de color | Paleta hecha a mano con tokens. No se usa inversión automática. |

## Fuera de alcance

- El popup y la página de bienvenida siguen claros.
- Páginas de pago que no son de coto.com.ar.
- Los banners de publicidad de Coto (son imágenes; quedan como son).

## Piezas

### 1. Ajuste `theme`

- Clave `theme` en `chrome.storage.local`. Valores: `"light"`, `"dark"`, `"auto"`. Si falta o
  es otro valor, vale `"light"`.
- En `src/popup.js`, sección Apariencia: una fila "Tema" con un control de tres botones
  (grupo de radio: Claro, Oscuro, Automático). Guarda al elegir, como los otros ajustes.
- La ayuda del popup suma una línea que explica el tema.

### 2. Interruptor: `src/theme.js`

Sigue el patrón de `src/skin.js`.

- `resolveTheme(setting, systemDark)` devuelve `"dark"` o `"light"`. Función pura.
- `installTheme(win, doc, storage)`:
  - Lee `theme` y escucha `storage.onChanged`.
  - En `"auto"` usa `win.matchMedia("(prefers-color-scheme: dark)")` y escucha su cambio.
  - Tema oscuro: pone `data-gondola-theme="dark"` en `<html>`. Tema claro: saca el atributo.
  - No depende de `data-gondola-skin`: funciona con el Diseño Góndola apagado.
- Sin fogonazo blanco: guarda el tema ya resuelto en `localStorage` de coto.com.ar (clave
  `gondola-theme`). En `document_start` lee esa clave de forma síncrona y pone el atributo
  antes de que se dibuje la página. Después confirma con `chrome.storage`. Si `localStorage`
  falla, se ignora el error.
- Se instala desde `src/badge-entry.js`, que ya corre en `document_start`.

### 3. Transición

- Solo cuando el tema cambia con la página ya abierta (por el ajuste o por el sistema en
  modo Automático). Nunca en la carga inicial.
- `doc.startViewTransition(() => aplicarAtributo())`. Antes pone una clase temporal en
  `<html>` (`gondola-theme-wave`) y la saca al terminar.
- CSS: con esa clase, `::view-transition-new(root)` anima
  `clip-path: circle(0% at 100% 0%)` → `circle(150% at 100% 0%)`, 650 ms,
  `cubic-bezier(0.23, 1, 0.32, 1)`. `::view-transition-old(root)` no se anima.
- Cambio instantáneo, sin animación, si: no existe `startViewTransition`, el usuario pidió
  `prefers-reduced-motion: reduce`, o `doc.hidden` es verdadero (pestaña que no se ve).

### 4. Paleta: `src/theme.css`

Los tokens `--g-*` pasan de `[data-gondola-skin]` a `:root`, con sus valores claros de hoy.
`[data-gondola-theme="dark"]` los redefine.

| Token | Claro (hoy) | Oscuro | Uso |
| --- | --- | --- | --- |
| `--g-bg` | `#ffffff` | `#0f1217` | Fondo de la página |
| `--g-surface` | `#ffffff` | `#171b22` | Tarjetas |
| `--g-surface-2` | `#ffffff` | `#1f242d` | Menús y ventanas |
| `--g-soft` | `#f5f6f8` | `#1f242d` | Rellenos suaves |
| `--g-line` | `#e6e8ec` | `#2b313c` | Bordes |
| `--g-ink` | `#16181d` | `#e6e9ee` | Texto |
| `--g-ink2` | `#5b616e` | `#a3aab8` | Texto secundario |
| `--g-red` | `#e20025` | `#d81e3a` | Relleno de botones de compra |
| `--g-red-d` | `#c4001f` | `#b8162f` | Botón de compra apretado |
| `--g-red-text` | `#e20025` | `#ff7084` | Texto de ofertas |
| `--g-navy` | `#14284b` | `#8fb0f0` | Acento de Góndola (texto, foco) |
| `--g-navy-soft` | `#eef2f9` | `#1a2540` | Fondo del acento |
| `--g-amber` | `#ffc233` | `#ffc233` | Destacado |
| `--g-amber-soft` | `#fff4d1` | `#3a2e0a` | Fondo del destacado |
| `--g-amber-ink` | `#6b4a00` | `#ffd873` | Texto del destacado |
| `--g-green` | `#0a7a3d` | `#4cc38a` | Bueno |
| `--g-green-soft` | `#e6f4ec` | `#12301f` | Fondo de bueno |
| `--g-plate` | `transparent` | `#e9ebef` | Placa detrás de las fotos de producto |

Reglas:

- Sin negro puro ni blanco puro. El fondo lleva un toque del azul de la marca.
- La altura se muestra con superficies más claras y bordes. En oscuro, las sombras se quitan.
- Las fotos de producto no se invierten: van sobre `--g-plate` con bordes redondos.
- `color-scheme: dark` en `<html>` para que las barras de desplazamiento y los controles
  nativos sean oscuros.
- Todo par texto/fondo cumple WCAG AA: 4,5:1 en texto normal, 3:1 en texto grande y en
  bordes de controles.
- Donde hoy se usa `--g-navy` como fondo con texto blanco, se crea un token aparte
  (`--g-navy-fill`, `#14284b` en claro y `#2a4a86` en oscuro) para no romper el contraste.

### 5. Colores de Góndola a tokens

`src/badge.css`, `src/skin.css`, `src/skin-list.css` y `src/skin-pdp.css` tienen colores
escritos a mano (`#fff`, grises, rojos; unos 170, 48 distintos en `src/badge.css`). Se
reemplazan por tokens. En modo claro el cambio no se nota: solo se unifican grises y tonos
casi iguales.

Para cubrir las familias de `src/badge.css` se suman tokens: `--g-ink3`, `--g-line-2`,
`--g-blue`, `--g-blue-soft`, `--g-danger`, `--g-danger-soft`. Sus valores están en el plan.

Al imprimir, la página sale clara aunque el tema sea oscuro.

### 6. Pintura de Coto

En un archivo aparte, `src/theme-coto.css`, todo bajo `[data-gondola-theme="dark"]`. Los estilos de Coto usan
selectores de Angular y a veces `!important`; donde chocan, la regla lleva `!important`
(misma norma que `src/skin.css`).

- Regla base: fondo y texto de `html` y `body`. Si una parte no está pintada, la página igual
  queda oscura.
- Por zona: encabezado y buscador, menú de categorías, inicio (carruseles y tarjetas), lista,
  producto, mini carrito, /carrito, pie, menús desplegables y ventanas.
- Logo: `filter` sobre el `<img>` del logo de Coto (`grayscale(1) contrast(1.8)`: el rojo pasa a gris
  oscuro y el contraste lo lleva a negro; el blanco queda blanco. Un contraste más fuerte endurece
  los bordes y se ven pixelados). Sin borde ni contorno. Se verifica sobre la imagen real.
- Antes de pintar se capturan los DOM reales del encabezado, inicio y carrito con
  `scripts/capture-dom.mjs`. Hoy solo hay capturas de la lista y del producto. Los selectores
  nuevos se anotan en `src/skin-dom.js` o en un archivo hermano.

## Qué pasa si algo falla

- No se puede leer el ajuste: la página queda clara.
- Chrome sin View Transitions: el tema cambia sin animación.
- Coto agrega una parte nueva: puede quedar un bloque claro, no una página blanca.
- Otras pestañas de Coto abiertas: cambian sin animación.

## Principios del producto

Solo se agrega un atributo en `<html>` y CSS. No se mueve ni se borra nada de Coto.
`PRODUCT.md` suma `data-gondola-theme` en "Capabilities and Constraints".

## Pruebas

- `tests/theme.test.js`: `resolveTheme` en los tres modos; `installTheme` pone y saca el
  atributo; reacciona a `storage.onChanged` y al cambio del sistema; lee y escribe
  `localStorage`; no anima en la carga inicial, ni con movimiento reducido, ni con la pestaña
  oculta; anima en los demás cambios.
- Prueba del popup: los tres botones guardan `theme` y muestran el valor guardado.
- `tests/theme-contrast.test.js`: lee los tokens de `src/theme.css` y verifica el contraste
  de cada par texto/fondo, en claro y en oscuro.
- Prueba de regresión: no quedan colores escritos a mano en los CSS de Góndola, fuera de una
  lista corta de excepciones (por ejemplo, el blanco sobre el botón rojo).
- Revisión manual en el sitio real, página por página, en claro y en oscuro, y de la onda.

## Orden de trabajo

1. Ajuste, interruptor y onda, con la paleta y la regla base.
2. Colores de Góndola a tokens.
3. Pintura de Coto: encabezado y logo, lista, producto, carrito, inicio, pie.
4. Revisión final, textos (`README.md`, `PRODUCT.md`, ayuda del popup) y versión nueva.
