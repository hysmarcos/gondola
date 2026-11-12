// Carrefour: el HTML no trae las promos (no aparece `discount_percentage`); la página
// las carga después. Verificado con la captura del 2026-11-11. Hasta tener otra fuente,
// devolvemos siempre null ("no se pudieron leer"), distinto de [] ("no hay promos").
export function parseCarrefour() {
  return null;
}
