// Información nutricional por EAN desde Open Food Facts. Vive en el service worker.
// La memoria vive en `cache`; solo los pedidos en vuelo se guardan en variables.
import { parseOff, offApiUrl } from "./nutrition.js";
import { validEan } from "./compare.js";

export function createNutritionService({ fetch, cache, timeoutMs = 8000, concurrency = 4 }) {
  const inflight = new Map(); // ean -> Promise<Nutrition | "missing" | "error">
  // Hasta `concurrency` pedidos a Open Food Facts a la vez (un carrito grande pide muchos).
  let active = 0;
  const queue = [];
  const slot = () =>
    new Promise((resolve) => {
      if (active < concurrency) {
        active++;
        resolve();
      } else queue.push(resolve);
    });
  const release = () => {
    const next = queue.shift();
    if (next) next();
    else active--;
  };

  // Sin cookies: nada del usuario viaja a Open Food Facts, solo el código de barras.
  async function load(ean) {
    await slot();
    try {
      const res = await fetch(offApiUrl(ean), { credentials: "omit", signal: AbortSignal.timeout(timeoutMs) });
      if (res.status === 404) return "missing";
      if (!res.ok) return "error";
      return parseOff(await res.json(), ean);
    } catch {
      return "error";
    } finally {
      release();
    }
  }

  async function run(ean) {
    try {
      const hit = (await cache.get([ean]))[ean];
      if (hit !== undefined) return hit;
    } catch {
      // sin memoria se pide igual
    }
    const result = await load(ean);
    // Un error no se guarda: la próxima vez se reintenta.
    if (result !== "error") {
      try {
        await cache.set({ [ean]: result });
      } catch {
        // sin memoria igual hay resultado
      }
    }
    return result;
  }

  // Nunca rechaza.
  function get(raw) {
    const ean = validEan(raw);
    if (!ean) return Promise.resolve("missing");
    if (!inflight.has(ean)) inflight.set(ean, run(ean).finally(() => inflight.delete(ean)));
    return inflight.get(ean);
  }

  return { get };
}
