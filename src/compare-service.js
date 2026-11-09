// Compara precios por EAN contra otros super (VTEX). Sin estado entre reinicios:
// la memoria vive en `cache`; solo los pedidos en vuelo se guardan en variables.
import { STORES } from "./stores.js";
import { searchUrl, parseSearch, simulationRequest, parseSimulation, bestOffer } from "./vtex.js";
import { validEan } from "./compare.js";

const MAX_EANS = 200;
const BATCH = 50;

// Deja pasar `limit` tareas a la vez; el resto espera turno.
function createLimiter(limit) {
  let active = 0;
  const queue = [];
  const next = () => {
    if (active >= limit || !queue.length) return;
    active++;
    const { task, resolve, reject } = queue.shift();
    task()
      .then(resolve, reject)
      .finally(() => {
        active--;
        next();
      });
  };
  return (task) =>
    new Promise((resolve, reject) => {
      queue.push({ task, resolve, reject });
      next();
    });
}

export function createCompareService({ fetch, cache, stores = STORES, concurrency = 4, timeoutMs = 8000 }) {
  const limiters = new Map(stores.map((s) => [s.id, createLimiter(concurrency)]));
  const inflight = new Map(); // "<storeId>:<ean>" -> Promise<Offer | "missing" | "error">

  // Pedido con límite por súper y tiempo máximo. Lanza si falla.
  // Sin cookies: las sesiones del usuario en esos súper nunca viajan.
  function request(store, url, init = {}) {
    return limiters.get(store.id)(async () => {
      const res = await fetch(url, { ...init, credentials: "omit", signal: AbortSignal.timeout(timeoutMs) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    });
  }

  async function simulate(store, hit, q) {
    try {
      const { url, init } = simulationRequest(store, hit, q);
      return parseSimulation(await request(store, url, init), q);
    } catch {
      return null;
    }
  }

  async function offerFor(store, hit) {
    // Sin stock no hay oferta posible: no vale la pena simular carritos.
    if (!hit || hit.stock <= 0) return "missing";
    const [s1, s2, s3] = await Promise.all([1, 2, 3].map((q) => simulate(store, hit, q)));
    return bestOffer(hit, { 1: s1, 2: s2, 3: s3 }) ?? "missing";
  }

  // Un lote de hasta 50 EAN en un súper. Nunca rechaza: devuelve { ean: valor }.
  async function runBatch(store, eans) {
    let hits;
    try {
      hits = parseSearch(await request(store, searchUrl(store, eans)));
    } catch {
      return Object.fromEntries(eans.map((e) => [e, "error"]));
    }
    const values = await Promise.all(eans.map((e) => offerFor(store, hits.get(e))));
    const out = Object.fromEntries(eans.map((e, i) => [e, values[i]]));
    try {
      await cache.set(Object.fromEntries(eans.map((e) => [`${store.id}:${e}`, out[e]])));
    } catch {
      // sin memoria igual hay resultado
    }
    return out;
  }

  async function compareStore(store, eans) {
    const keyOf = (e) => `${store.id}:${e}`;
    let cached = {};
    try {
      cached = (await cache.get(eans.map(keyOf))) ?? {};
    } catch {
      cached = {};
    }
    const result = {};
    const waiting = [];
    const fresh = [];
    for (const e of eans) {
      const k = keyOf(e);
      if (k in cached) result[e] = cached[k];
      else if (inflight.has(k)) waiting.push([e, inflight.get(k)]);
      else fresh.push(e);
    }
    for (let i = 0; i < fresh.length; i += BATCH) {
      const chunk = fresh.slice(i, i + BATCH);
      const batch = runBatch(store, chunk);
      for (const e of chunk) {
        const p = batch.then((m) => m[e]);
        inflight.set(keyOf(e), p);
        waiting.push([e, p]);
      }
      batch.then(() => chunk.forEach((e) => inflight.delete(keyOf(e))));
    }
    await Promise.all(
      waiting.map(async ([e, p]) => {
        result[e] = await p;
      }),
    );
    return result;
  }

  async function compare(eans) {
    const valid = [...new Set((eans ?? []).map(validEan).filter(Boolean))].slice(0, MAX_EANS);
    const out = Object.fromEntries(valid.map((e) => [e, {}]));
    if (!valid.length) return out;
    await Promise.all(
      stores.map(async (store) => {
        const r = await compareStore(store, valid);
        for (const e of valid) out[e][store.id] = r[e];
      }),
    );
    return out;
  }

  return { compare };
}
