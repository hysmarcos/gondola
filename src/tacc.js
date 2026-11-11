// Sin TACC: el dato de Coto (filtro "SIN TACC" de su búsqueda) con una regla de seguridad.
// Coto marcó "Avena Tradicional Sturla" como Sin TACC (medición 2026-11-10), y el Código
// Alimentario (art. 1383) excluye la avena: si el producto menciona un cereal con gluten,
// Góndola no muestra el verde. Un NO de Coto solo dice "no figura", no "contiene gluten".

const FACET = "SIN TACC";

// "SI", "NO" o null según la faceta, si el único resultado es el producto. undefined si
// hay varios resultados: la faceta mezcla y hace falta buscar con el filtro.
export function taccFromSearch(json, id) {
  const results = json?.response?.results ?? [];
  if (!results.some((r) => r?.data?.id === id)) return null;
  if (results.length > 1) return undefined;
  const facet = (json.response.facets ?? []).find((f) => f?.name === FACET);
  const option = (facet?.options ?? []).find((o) => (o?.value === "SI" || o?.value === "NO") && o.count > 0);
  return option?.value ?? null;
}

// La misma búsqueda, filtrada por SIN TACC = SI o NO.
export function withTaccFilter(url, value) {
  const u = new URL(url);
  u.searchParams.set(`filters[${FACET}]`, value);
  return u.toString();
}

// Trigo (salvo "trigo sarraceno", que no tiene gluten), avena, cebada, centeno, malta,
// espelta o kamut, en el nombre o en los ingredientes.
const CEREAL = /\b(trigo(?!\s+sarraceno)|avena|cebada|centeno|malta|espelta|kamut)\b/;

const fold = (s) => String(s ?? "").normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

function risk(name, n) {
  const hit = (fold(name) + " " + fold(n?.ingredients?.text)).match(CEREAL);
  if (hit) return `menciona ${hit[1]}`;
  if (n?.allergens?.includes("gluten")) return "declara gluten";
  return null;
}

// { kind: "ok" | "warn" | "no" | "unknown", text }.
export function taccStatus(tacc, name, n) {
  const why = risk(name, n);
  if (tacc === "SI") {
    return why
      ? { kind: "warn", text: `Coto lo marca Sin TACC, pero ${why}. Revisá el envase.` }
      : { kind: "ok", text: "Coto lo marca Sin TACC" };
  }
  if (tacc === "NO") return { kind: "no", text: "No figura como Sin TACC en Coto" };
  if (n?.glutenFreeLabel && !why) return { kind: "ok", text: "Sin TACC según Open Food Facts" };
  return { kind: "unknown", text: "Sin dato de TACC" };
}
