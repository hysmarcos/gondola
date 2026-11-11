// Información nutricional desde Open Food Facts, por código de barras (EAN).
// Funciones puras: no piden nada a la red.

const OFF = "https://world.openfoodfacts.org";

// [clave, campo de Open Food Facts, nombre, unidad], en el orden de la tabla.
export const NUTRIENTS = [
  ["kcal", "energy-kcal", "Valor energético", "kcal"],
  ["carbs", "carbohydrates", "Carbohidratos", "g"],
  ["sugars", "sugars", "Azúcares", "g"],
  ["proteins", "proteins", "Proteínas", "g"],
  ["fat", "fat", "Grasas totales", "g"],
  ["saturatedFat", "saturated-fat", "Grasas saturadas", "g"],
  ["transFat", "trans-fat", "Grasas trans", "g"],
  ["fiber", "fiber", "Fibra", "g"],
  ["sodiumMg", "sodium", "Sodio", "mg"],
];

// Categorías raíz de Coto que son comida o bebida: Almacén, Frescos, Bebidas, Congelados.
const FOOD_ROOTS = new Set(["catv00001254", "catv00001255", "catv00001256", "catv00001296"]);

// Menos nutrientes que esto cada 100 g no es una tabla: es una ficha a medio cargar.
const MIN_NUTRIENTS = 3;

export const offProductUrl = (ean) => `${OFF}/product/${ean}`;
const FIELDS = "product_name,nutriments,serving_size,serving_quantity,last_modified_t,image_front_url,image_nutrition_url,image_ingredients_url";
export const offApiUrl = (ean) => `${OFF}/api/v2/product/${ean}?fields=${FIELDS}`;

// Fotos del envase: solo https de los servidores de imágenes de Open Food Facts.
const PHOTO = /^https:\/\/(images|static)\.openfoodfacts\.org\//;
const photo = (url) => (typeof url === "string" && PHOTO.test(url) ? url : null);

// Bebidas: su tabla va cada 100 ml aunque Coto las venda por unidad.
const DRINKS = "catv00001256";
export function isDrink(groups) {
  return (groups ?? []).some((g) => g?.group_id === DRINKS);
}

export function isFood(groups) {
  return (groups ?? []).some((g) => FOOD_ROOTS.has(g?.group_id));
}

// Comida o bebida y no pesable: el código de un pesable no es el de un envase con tabla.
export function nutriEligible(data) {
  const weighable = Number(data?.product_weighable) === 1 || data?.product_unit_of_measure === "KGS";
  return isFood(data?.groups) && !weighable;
}

// Número válido o null. `capped`: cada 100 g, gramos ≤ 100 y kcal ≤ 900.
// El sodio llega en gramos: se valida así y se devuelve en mg.
function value(raw, unit, capped) {
  if (raw === null || raw === undefined || raw === "") return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return null;
  if (capped && unit === "kcal" && n > 900) return null;
  if (capped && unit !== "kcal" && n > 100) return null;
  return unit === "mg" ? Math.round(n * 1000) : n;
}

function read(nutriments, suffix, capped) {
  const out = {};
  for (const [key, field, , unit] of NUTRIENTS) {
    const v = value(nutriments?.[`${field}${suffix}`], unit, capped);
    if (v !== null) out[key] = v;
  }
  return out;
}

// Respuesta de la API → { per100, perServing, servingSize, url } o "missing".
export function parseOff(json, ean) {
  const product = json?.status === 1 ? json.product : null;
  if (!product) return "missing";
  const per100 = read(product.nutriments, "_100g", true);
  if (Object.keys(per100).length < MIN_NUTRIENTS) return "missing";
  const serving = read(product.nutriments, "_serving", false);
  return {
    per100,
    perServing: Object.keys(serving).length ? serving : null,
    servingSize: product.serving_size || null,
    servingQty: value(product.serving_quantity, "g", false) || null,
    updatedAt: Number(product.last_modified_t) > 0 ? Number(product.last_modified_t) * 1000 : null,
    photos: { front: photo(product.image_front_url), nutrition: photo(product.image_nutrition_url), ingredients: photo(product.image_ingredients_url) },
    url: offProductUrl(ean),
  };
}
