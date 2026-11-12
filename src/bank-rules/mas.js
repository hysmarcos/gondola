// Reglas a mano de las promos online de Más. Fuente: la API de promos de masonline.com.ar
// (la misma que lee src/bank-promos/service.js), leída el 2026-11-12.
// Más cambia sus promos online casi a diario: lo que no está acá queda sin restar.
import { COCA_COLA, toRe, norm } from "../exclusions.js";

const SOURCE = "https://www.masonline.com.ar/promociones-bancarias (2026-11-12)";

const plain = (s) => norm(s).trim();

export function cardOf(promo) {
  const bank = plain(promo?.bankLabel);
  // Solo el club y la billetera MODO. "ICBC Modo" o "BNA+MODO" son de un banco: no se adivinan.
  if (bank === "masclub") return { cardId: "masclub", plan: null };
  if (bank === "modo") return { cardId: "modo", plan: null };
  return null;
}

// Grupos de Coto (scripts/leaves.json) de los rubros que nombra el legal de MasClub.
const MASCLUB_GROUPS = new Set([
  "catv00003769", // Quesos
  "catv00003285", // Frutas y verduras
  "catv00001464", // Huevos
  "catv00002211", // Aderezos y salsas
  "catv00001274", // Harinas
  "catv00003266", // Leches (frescas, larga vida)
  "catv00002784", // Azúcar
  "catv00003530", // Panadería: panes de molde, de viena, tortillas
  "catv00001300", // Bebidas con alcohol: bebidas blancas, vinos, fernet, cervezas (todas: mejor de más)
  "catv00001292", // Carnicería
  "catv00003237", // Hamburguesas y milanesas (carnes elaboradas)
  "catv00001293", // Pescadería
  "catv00003240", // Pescadería congelada
  "catv00001462", // Aves (pollo)
  "catv00001990", // Electro: electrodomésticos, informática, celulares, climatización, línea blanca
  "catv00002061", // Rodados
  "catv00001309", // Farmacia (medicamentos)
]);

// Por nombre, por si el producto viene sin grupos. Los nombres de Coto empiezan por el rubro.
const MASCLUB_NAMES = [
  /^quesos?\b/, /^huevos?\b/, /^aceite\b/, /^vinagre\b/, /^(aderezo|mayonesa|ketchup|mostaza|salsa golf)\b/,
  /^harina\b/, /^leche\b/, /^azucar\b/, /^pan(es)?\b(?!\s+rallado)/, /^tortillas?\b/,
  /^(fernet|vino|vodka|whisky|gin|ron|licor|cerveza|espumante|champagne)\b/,
  /^pollo\b|\bde pollo\b/, /^(merluza|salmon|langostinos?|calamar(es)?|abadejo|trucha|pescado)\b/,
  /\bmonster energy\b/,
];

// Gaseosas y aguas de Cervecería y Maltería Quilmes y la línea Coca-Cola, por nombre o marca.
const MASCLUB_BRANDS = toRe([
  ...COCA_COLA, "bonaqua", "smart water",
  "pepsi", "seven up", "7up", "7 up", "paso de los toros", "gatorade", "glaciar", "eco de los andes",
  "h2oh", "awafrut", "mirinda", "red bull", "rockstar", "stella artois", "budweiser", "michelob", "goose island",
]);
// Cervezas de Quilmes con nombres que también son palabras comunes: solo por marca.
const MASCLUB_BRAND_ONLY = toRe(["quilmes", "corona", "brahma", "patagonia", "eazy", "andes", "temple", "monster"]);

function masClubOnline(p) {
  return (
    p.onSale || // "NO ACUMULABLE CON OTRAS PROMOCIONES VIGENTES Y/O PRODUCTOS EN LIQUIDACIÓN"
    (p.groups ?? []).some((g) => MASCLUB_GROUPS.has(g)) ||
    MASCLUB_NAMES.some((re) => re.test(p.name)) ||
    MASCLUB_BRANDS.test(p.name) || MASCLUB_BRANDS.test(p.brand) ||
    MASCLUB_BRAND_ONLY.test(p.brand) ||
    (/^agua\b/.test(p.name) && /\bnestle\b/.test(`${p.name} ${p.brand}`)) // "Aguas Nestlé"
  );
}

export const exclusions = [
  // MasClub "Sin tope. Exclusivo MasOnline." (25%, martes 27 de octubre): "no acumulable…"
  // y la lista que sigue a "EXCLUIDOS - NO INCLUYE:".
  { hash: "8868ade6", source: SOURCE, test: masClubOnline },
  // MODO "Desde APP MODO o APP de bancos adheridos" (20%): sin oraciones de exclusión, la
  // huella es el legal entero (releído el 2026-11-12). Acumulable, compra mínima y tope por
  // banco; no excluye productos.
  { hash: "09bad098", source: SOURCE, test: () => false },
];
