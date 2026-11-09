// Productos excluidos de todos los descuentos y promociones bancarias de Coto.
// Fuente: coto.com.ar/terminos-descuentos, bloque "Productos excluidos para todos los
// descuentos y/o promociones" (noviembre 2026).

const GROUPS = new Set([
  "catv00001292", // Carnicería: novillo, ternera, cerdo, menudencias
  "catv00001462", // Aves
  "catv00001990", // Electro
  "catv00002061", // Rodados
  "catv00001274", // Harinas
  "catv00002784", // Azúcar
  "catv00003237", // Hamburguesas y milanesas (carnes elaboradas)
]);

const NAME_RULES = [
  /\baceite\b.*\b(girasol|mezcla)\b/,
  /\b(salame|salamin|chorizo|morcilla|salchicha|longaniza|cantimpalo)/,
  /\bpollo\b.*\b(entero|trozado|pata|muslo|pechuga|suprema|alas?)\b|\b(pata y muslo|pechuga|suprema)\b.*\bpollo\b/,
  /\b(leche|formula)\b.*\b(infantil|etapa)\b.*\b[12]\b|\betapa\s*[12]\b/,
  /\bneumatic/,
];

const BRANDS = [
  "coca-cola", "coca cola", "crush", "fanta", "schweppes", "sprite", "aquarius", "smartwater",
  "cepita", "benedictino", "powerade", "ades", "hi-c", "monster",
  "catena zapata", "nicola catena", "alma negra", "padrillos", "enemigo", "dv catena",
  "saint felicien", "nicasia", "tilia",
  "chandon", "mercier", "baron b", "dom perignon", "pommery", "moet", "la grande dame", "krug",
];
const BRAND_RE = new RegExp(`(^|[^a-z])(${BRANDS.map((b) => b.replace(/[-]/g, "\\-")).join("|")})([^a-z]|$)`);

function norm(text) {
  return String(text ?? "").normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

// "excluido" si el producto no recibe promos bancarias, si no null.
export function exclusionReason(data) {
  if ((data?.groups ?? []).some((g) => GROUPS.has(g?.group_id))) return "excluido";
  const name = norm(data?.sku_display_name);
  if (NAME_RULES.some((re) => re.test(name))) return "excluido";
  if (BRAND_RE.test(name) || BRAND_RE.test(norm(data?.product_brand))) return "excluido";
  return null;
}
