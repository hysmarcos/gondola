// Cliente de comparación en la página. Junta los EAN pedidos durante
// `delayMs` y hace un solo `send(eans, stores)`. Los resultados duran lo que la página.
// `send` y `setTimer` se inyectan (sin APIs de chrome acá).
// La lista de súper viene del mensaje "settings" (`setStores`). Con `waitForStores`, nada se
// envía hasta que llega la primera: un súper apagado no se consulta ni la primera vez.
export function createCompareClient({ send, stores = () => undefined, waitForStores = false, delayMs = 150, setTimer = setTimeout }) {
  const done = new Map(); // ean -> StoreResults
  const inflight = new Map(); // ean -> Promise<StoreResults>
  let batch = null; // { eans: string[], resolvers: Map<ean, fn>, gen: number }
  let gen = 0; // sube con cada cambio de la lista de súper
  let list; // lista de ids puesta con setStores
  let release = () => {};
  const ready = waitForStores ? new Promise((r) => (release = r)) : null;

  async function flush(b) {
    if (batch === b) batch = null;
    if (ready) await ready;
    const resolveAll = (res) => b.eans.forEach((ean) => b.resolvers.get(ean)(res));
    // La lista cambió antes de enviar: este lote es de la lista vieja. Se resuelve vacío
    // y quien lo pidió vuelve a pedir (reset() ya vació `done` e `inflight`).
    if (b.gen !== gen) return resolveAll({});
    let result;
    try {
      result = await send(b.eans, list ?? stores());
    } catch {
      result = null;
    }
    const safe = result && typeof result === "object" ? result : {};
    const current = b.gen === gen;
    for (const ean of b.eans) {
      const r = safe[ean];
      const res = r && typeof r === "object" ? r : {};
      // Si la lista cambió mientras tanto, la respuesta es de la lista vieja y no se guarda.
      if (current) {
        done.set(ean, res);
        inflight.delete(ean);
      }
      b.resolvers.get(ean)(res);
    }
  }

  function request(ean) {
    if (done.has(ean)) return Promise.resolve(done.get(ean));
    if (inflight.has(ean)) return inflight.get(ean);
    if (!batch) {
      const b = { eans: [], resolvers: new Map(), gen };
      batch = b;
      setTimer(() => flush(b), delayMs);
    }
    const p = new Promise((resolve) => batch.resolvers.set(ean, resolve));
    batch.eans.push(ean);
    inflight.set(ean, p);
    return p;
  }

  const peek = (ean) => done.get(ean);

  // Cambió la lista de súper: lo resuelto, lo en vuelo y el lote abierto dejan de valer.
  function reset() {
    gen++;
    done.clear();
    inflight.clear();
    batch = null;
  }

  // Lo llaman badge.js y cart-ui.js con cada "settings": da igual quién llegue primero.
  // La primera lista no resetea (nada se envió con otra); una distinta, sí.
  function setStores(ids) {
    const next = Array.isArray(ids) ? [...ids] : undefined;
    const first = list === undefined;
    const changed = !first && String(next) !== String(list);
    list = next;
    if (changed) reset();
    release();
    return changed;
  }

  return { request, peek, reset, setStores };
}
