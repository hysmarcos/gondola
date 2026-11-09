# Coto precio por unidad

Extensión de Chrome. Agrega la opción **"Precio por kg/L: menor a mayor"** al menú "Ordenar por" de coto.com.ar, en categorías y búsquedas. Usa el precio final con ofertas (incluye 2x1 y pago en 1 cuota). Todo lo nativo de Coto sigue funcionando. También muestra el precio del mismo producto (por código de barras) en Carrefour, Día y Más; se apaga desde el popup.

## Instalar

1. `npm install`
2. `npm run build`
3. En Chrome, abrí `chrome://extensions`, activá **Modo de desarrollador**, tocá **Cargar descomprimida** y elegí esta carpeta.

## Desarrollo

- `npm test`: corre los tests.
- `npm run fixtures`: baja respuestas reales de la API de Coto a `tests/fixtures/`.
- `npm run fixtures:vtex`: baja respuestas reales de Carrefour, Día y Más a `tests/fixtures/`.
- Diseño: `docs/superpowers/specs/2026-11-09-coto-precio-por-unidad-design.md`
