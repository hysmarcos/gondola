// Promos de banco de los otros súper (service worker). Baja una vez por día por súper y
// guarda todo lo parseado en `cache`; al responder deja solo las online y en fecha.
import { STORES } from "../stores.js";
import { parseMas } from "./mas.js";
import { parseDia } from "./dia.js";
import { parseCarrefour } from "./carrefour.js";

const MAS = "https://www.masonline.com.ar/_v/private/gdn-services/content";
const MAS_FIELDS =
  "id,title,sub_title,discount_percentage,discount_text_info,active,active_from,active_to,ecommerce,monday,tuesday,wednesday,thursday,friday,saturday,sunday,idBank,idCard,legal";
// Las mismas URL que scripts/capture-bank-fixtures.mjs.
export const MAS_PROMOS_URL = `${MAS}/banks-promotions?_fields=${MAS_FIELDS}&_from=0&_to=99`;
export const MAS_BANKS_URL = `${MAS}/financing-banks?_fields=id,name&_from=0&_to=99`;

// Cómo se baja y se lee cada súper. get(url, "json" | "text") lanza si el pedido falla.
// Devuelven Promo[], o null si no se pudieron leer.
export const SOURCES = {
  mas: async (get) => {
    const [promos, banks] = await Promise.all([get(MAS_PROMOS_URL, "json"), get(MAS_BANKS_URL, "json")]);
    return parseMas({ promos, banks });
  },
  dia: async (get, store) => parseDia(await get(store.promosUrl, "text")),
  // El HTML de Carrefour no trae las promos: no vale la pena bajar 1 MB para nada.
  carrefour: async () => parseCarrefour(),
};

// null = sin límite. Una fecha que no se entiende deja la promo afuera.
function inDate(p, t) {
  const from = p.from == null ? -Infinity : Date.parse(p.from);
  const to = p.to == null ? Infinity : Date.parse(p.to);
  return from <= t && t <= to;
}

export function createBankPromosService({ fetch, cache, now = Date.now, parsers = SOURCES, stores = STORES, timeoutMs = 8000 }) {
  // Sin cookies: las sesiones del usuario en esos súper nunca viajan.
  async function get(url, kind) {
    const res = await fetch(url, { credentials: "omit", signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return kind === "json" ? res.json() : res.text();
  }

  async function load(store) {
    try {
      const hit = (await cache.get([store.id]))?.[store.id];
      if (Array.isArray(hit)) return hit;
    } catch {
      // sin memoria se baja de nuevo
    }
    let promos;
    try {
      promos = await parsers[store.id](get, store);
    } catch {
      return "error";
    }
    if (!Array.isArray(promos)) return "error";
    try {
      await cache.set({ [store.id]: promos });
    } catch {
      // sin memoria igual hay resultado
    }
    return promos;
  }

  // storeIds: qué súper pedir. → { [storeId]: Promo[] | "error" }
  async function getPromos(storeIds) {
    const asked = Array.isArray(storeIds) ? stores.filter((s) => storeIds.includes(s.id) && parsers[s.id]) : [];
    const out = {};
    await Promise.all(
      asked.map(async (store) => {
        const promos = await load(store);
        const t = now();
        out[store.id] = promos === "error" ? "error" : promos.filter((p) => p && p.online && inDate(p, t));
      }),
    );
    return out;
  }

  return { get: getPromos };
}
