# v5: tarjeta unificada y "Más barato de la categoría"

Aprobado por el usuario el 2026-11-09 (mockup "Hoy / Propuesta").

## 1. Más barato de la categoría
- Un solo producto por grupo (kg, L, …): el de menor precio por unidad de toda la categoría
  (hasta 1.000 productos), con el banco elegido si aplica. Solo si el grupo tiene 3 o más.
- Con orden por unidad sale del orden ya calculado; con orden nativo el intermediario baja
  la categoría en segundo plano (misma caché de 5 min, compartida entre órdenes).
- Mensaje `{type: "best", best: {url: grupo}, seq}`; la tarjeta lo muestra en cualquier página.

## 2. Un solo precio por unidad
- Valor = el mismo que ordena (`bankValue ?? value`), con un motivo: "con ICBC hoy",
  "llevando 2", "con Comunidad", "en 1 pago". Notas (escurrido, doble hoja, ≈) en letra chica.
- En tarjetas no van "Precio real para comparar" ni "Banco no aplica" (siguen en la PDP).

## 3. Bloque de Coto estandarizado (solo si hay etiqueta; si no, Coto queda igual)
- Bloque propio: oferta unificada ("15% dto + 5% Comunidad"), precio final grande con el
  regular tachado al lado, fila de precio por unidad, cartel "Más barato de la categoría".
- Se ocultan (atributo, sin borrar nodos): `.descuentos-slot`, `h4.card-title`, "Precio
  Regular", "Precio por 1 …", banner "CON COMUNIDAD PAGAS". "Sin impuestos" queda chico.
- La tarjeta pasa a columna con el botón abajo: filas parejas.
- PDP: misma regla de un solo precio por unidad; se oculta "Precio por 1 …".

## 4. Comunidad Coto
- Descuentos "+N%" son Comunidad. Ajuste `comunidad` (default encendido): apagado, no se
  usan para el precio final, el orden ni el carrito.
