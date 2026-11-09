# v3: unidades raras, reglas reales de bancos, mini-carrito y tarjeta clara — Diseño

Fecha: 2026-11-09. Extiende los diseños de precio por unidad y de bancos y carrito.

## Datos verificados (2026-11-09, en vivo)

### Unidades (relevamiento de 116 categorías hoja, 15.522 productos)

| `product_format` / cantidad | Productos | Hoy | v3 |
|---|---|---|---|
| vacío / 0 | 6.370 | sin dato | sin dato, salvo pesables |
| Kilo, Kilogramo (+ escurrido) | 4.609 | kg | kg |
| Litro (+ escurrido) | 2.244 | L | L |
| Unidad (+ escurrido) | 1.403 | unidad | unidad |
| Gramos/100 | 663 | kg | kg |
| Mililitros/100 | 126 | L | L |
| **Gramos escurridos/100** | 14 | **sin dato (bug)** | kg escurrido |
| **Cuadrado/1** (m²) | 53 | sin dato | m², o papel (ver abajo) |
| **Metro/1** | 37 | sin dato | m, o papel |
| **Cúbicos/100** (cm³) | 2 | sin dato | L (factor 1000/100) |
| Medida/1 | 1 | sin dato | sin dato |

- **Pesables**: `product_weighable: 1` o `product_unit_of_measure: "KGS"` sin `product_format` (ej. "Jamón Cocido Feteado PRIMERA MARCA X Kg"): `listPrice` ya es por kilo. v3: grupo kg con `formatPrice = listPrice`.
- **Papel** (format Cuadrado o Metro, y nombre de papel higiénico o rollo de cocina): el m² no compara bien entre doble y simple hoja. v3 lee el nombre:
  - Papel higiénico: metros por rollo (`30 M`, `80 Mts`, `x 30m`, `30 Mtr`) × rollos (`4 Un`, `X 4`, `12u`, `24 rollos`, `Paquete 4 Unidades`) → **$ cada 10 m de rollo**.
  - Rollo de cocina: paños (`200 Paños`) × rollos (`X3`, `3 Un`, `Paquete 3 Unidades`) → **$ cada 100 paños**.
  - Si no se puede leer: $/m² (o $/m). Si dice "doble hoja" o "D/H": nota `doble hoja`.

### Promos bancarias (legales `coto.com.ar/terminos-descuentos`)

- Todas las promos bancarias online dicen "no acumula con otros descuentos, ofertas y/o promociones". **Un producto en oferta no recibe descuento del banco.** v3 lo aplica a todas las promos (también Naranja X, por prudencia: mostrar de menos es mejor que prometer de más).
- **Excluidos de todos los descuentos** (bloque "Productos excluidos para todos los descuentos"):
  - Categorías Coto: Carnicería `catv00001292`, Aves `catv00001462`, Electro `catv00001990`, Rodados `catv00002061`, Harinas `catv00001274`, Azúcar `catv00002784`, Hamburguesas y Milanesas `catv00003237`.
  - Por nombre: aceite de girasol o mezcla; embutidos (salame, salamín, chorizo, morcilla, salchicha, longaniza, cantimpalo); pollo (entero, trozado, pata, muslo, pechuga, suprema, alas); leches infantiles etapa 1 y 2; neumáticos.
  - Por marca o nombre: Coca-Cola, Crush, Fanta, Schweppes, Sprite, Aquarius, Smartwater, Cepita, Benedictino, Powerade, Ades, Hi-C, Monster; Catena Zapata, Nicola Catena, Alma Negra, Padrillos, Animal, Enemigo, DV Catena, Saint Felicien, Nicasia, Tilia; Chandon, Mercier, Barón B, Dom Perignon, Pommery, Moët, La Grande Dame, Krug.
  - La categoría sale de `data.groups[].group_id`.
- El checkout dice: "Se aplicarán ofertas y promociones bancarias vigentes en el día de HOY". El día que vale es el del pedido.

### Mini-carrito (desplegable del ícono)

- `cart-float > ul.dropdown-menu.dropdown-carrito.show`. Cada línea: `card-product-float` con `p.titulo-producto` y `p.precio > span.precio-final` (precio de lista × cantidad). Total: `div.total-precio > h4.roar-total`.
- Muestra precios de lista, sin ofertas ni banco.

### Tarjeta de producto

- `.centro-precios`: `h3.nombre-producto`, `.descuentos-slot` (`small.offer-crum` + `h4.card-title` precio a pagar), `small` "Precio Regular: …", `small` "Precio sin impuestos nacionales: …", `small` "Precio por 1 Kilo: …" (sobre precio de lista), `.bottom-botones`.

## Comportamiento v3

### Etiqueta → caja "Precio real para comparar"

Reemplaza las dos líneas sueltas de v2 por una caja después del precio a pagar (`.descuentos-slot`, o `h4.card-title` si no hay oferta):

```
Precio real para comparar
$5.177 /kg                      ← grande
llevando 3 · doble hoja         ← nota, si hay
Hoy con ICBC: $3.624/kg         ← verde, si aplica
Banco no aplica: ya está en oferta | excluido de promos   ← gris, si hay promo elegida y no aplica
```

- Las líneas de Coto "Precio Regular", "Precio sin impuestos nacionales" y "Precio por …" pasan a chicas y grises (atributo `data-coto-unit-dim` + CSS). "Precio Regular" además tachada. No se borra nada.
- Insignia **"Más barato por kg"** (o "por L", "por 10 m", etc.) en la tarjeta con menor precio de su grupo entre las tarjetas visibles, si hay al menos 3 tarjetas de ese grupo.
- Página de producto: la misma caja después del primer `.price`.

### Mini-carrito

- Al abrirse, pide el análisis (`cartRequest`), aunque no estés en `/carrito`.
- En cada línea con descuento: precio con promo debajo del de Coto (`$X con promo`), y el de Coto tachado.
- Debajo del total: `Con promos: $X` y `Hoy con <Banco>: $Y` si hay promo elegida.
- Si el total de Coto no coincide con lo leído, no muestra nada.

### Carrito y cálculo

- Reintegro bancario solo sobre líneas **sin oferta y no excluidas**.
- Cada línea del análisis trae `total` (con promos) y `listTotal`.

## Etiqueta (forma)

`{ group, value, drained, take, note, bankValue, bankName, bankBlocked }`

- `group`: `kg | L | unidad | m2 | m | rollo10m | panos100 | sin_dato`.
- `bankBlocked`: `"oferta" | "excluido" | null` (solo si hay alguna promo elegida para el día y no aplica).

## Orden

Los grupos dejan de ser fijos: todos los grupos con datos, el de más productos primero (empate: kg, L, unidad, rollo10m, panos100, m2, m), después `sin_dato`.

## Herramienta de auditoría (loop)

`scripts/audit.mjs` arma `dist-dev/audit.js` (no va en la extensión). En la página de Coto, `await __cotoAudit()` recorre todas las categorías hoja y devuelve:

- `noUnit`: productos de Almacén, Frescos, Bebidas, Congelados, Limpieza y Perfumería en `sin_dato`.
- `outliers`: $/unidad 8 veces mayor o menor que la mediana de su categoría y grupo.
- `sizeMismatch`: el nombre dice un tamaño (ej. `500g`, `1,5 L`) y `formatPrice / listPrice` implica otro (diferencia > 15%).

El loop: correr, revisar, corregir con test, repetir hasta que lo que quede sea error de datos de Coto (documentado).

## Errores

Igual que antes: si algo falla, Coto se ve y funciona como sin extensión.
