// Cliente de comparación en la página. Junta los EAN pedidos durante
// `delayMs` y hace un solo `send(eans, stores())`. Los resultados duran lo que la página.
// `send` y `setTimer` se inyectan (sin APIs de chrome acá).
export function createCompareClient({ send, stores = () => undefined, delayMs = 150, setTimer = setTimeout }) {
  const done = new Map(); // ean -> StoreResults
  const inflight = new Map(); // ean -> Promise<StoreResults>
  let batch = null; // { eans: string[], resolvers: Map<ean, fn> }
  let gen = 0; // sube con cada reset()

  async function flush(b) {
    batch = null;
    const mine = gen;
    let result;
    try {
      result = await send(b.eans, stores());
    } catch {
      result = null;
    }
    const safe = result && typeof result === "object" ? result : {};
    for (const ean of b.eans) {
      const r = safe[ean];
      const res = r && typeof r === "object" ? r : {};
      // Si cambió la lista de súper mientras tanto, esta respuesta es de la lista vieja.
      if (mine === gen) done.set(ean, res);
      inflight.delete(ean);
      b.resolvers.get(ean)(res);
    }
  }

  function request(ean) {
    if (done.has(ean)) return Promise.resolve(done.get(ean));
    if (inflight.has(ean)) return inflight.get(ean);
    if (!batch) {
      const b = { eans: [], resolvers: new Map() };
      batch = b;
      setTimer(() => flush(b), delayMs);
    }
    const p = new Promise((resolve) => batch.resolvers.set(ean, resolve));
    batch.eans.push(ean);
    inflight.set(ean, p);
    return p;
  }

  const peek = (ean) => done.get(ean);
  // Cambió la lista de súper: lo ya resuelto deja de valer.
  const reset = () => {
    gen++;
    done.clear();
  };

  return { request, peek, reset };
}
