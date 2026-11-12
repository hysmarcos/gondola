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

// Embutidos y neumáticos: solo si el nombre empieza con eso ("Queso Sabor Salame" no es
// un embutido). Leches infantiles: solo etapa 1 o 2, no cualquier "1 Kg" o "2 Años".
const NAME_RULES = [
  /\baceite\b.*\b(girasol|mezcla)\b/,
  /^(salame|salamin|chorizo|morcilla|salchicha|longaniza|cantimpalo)/,
  /\bpollo\b.*\b(entero|trozado|pata|muslo|pechuga|suprema|alas?)\b|\b(pata y muslo|pechuga|suprema)\b.*\bpollo\b/,
  /\betapa\s*[12]\b|\binfantil\s+(?:etapa\s*)?[12]\b/,
  /^neumatic/,
  /\bmonster energy\b/,
];

// Línea Coca-Cola. También la usan las reglas de los otros súper (bank-rules).
export const COCA_COLA = [
  "coca-cola", "coca cola", "crush", "fanta", "schweppes", "sprite", "aquarius", "smartwater",
  "cepita", "benedictino", "powerade", "ades", "hi-c",
];
const BRANDS = [
  ...COCA_COLA,
  "catena zapata", "nicola catena", "alma negra", "padrillos", "enemigo", "dv catena",
  "saint felicien", "nicasia", "tilia",
  "chandon", "mercier", "baron b", "dom perignon", "pommery", "moet", "la grande dame", "krug",
];
// Marcas que también son palabras comunes ("Animal Print", "Monster Jam"): solo por marca.
const BRAND_ONLY = ["animal", "monster"];
export const toRe = (list) => new RegExp(`(^|[^a-z])(${list.map((b) => b.replace(/[-]/g, "\\-")).join("|")})([^a-z]|$)`);
const BRAND_RE = toRe(BRANDS);
const BRAND_ONLY_RE = toRe(BRAND_ONLY);

export function norm(text) {
  return String(text ?? "").normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

// "excluido" si el producto no recibe promos bancarias, si no null.
export function exclusionReason(data) {
  if ((data?.groups ?? []).some((g) => GROUPS.has(g?.group_id))) return "excluido";
  const name = norm(data?.sku_display_name).trim();
  const brand = norm(data?.product_brand);
  if (NAME_RULES.some((re) => re.test(name))) return "excluido";
  if (BRAND_RE.test(name) || BRAND_RE.test(brand) || BRAND_ONLY_RE.test(brand)) return "excluido";
  return null;
}
