// Memoria de precios de otros super (6 h). Guarda todo bajo `cmpCache`
// como { [clave]: { at, v } }. Clave: "<storeId>:<ean>".
// `storage` tiene la forma de chrome.storage.local.
const KEY = "cmpCache";

export function createPriceCache(storage, now = Date.now, { ttlMs = 21_600_000, max = 3000 } = {}) {
  // Las escrituras van en cadena: cada una espera a la anterior.
  let chain = Promise.resolve();

  const readAll = async () => (await storage.get([KEY]))[KEY] || {};

  async function get(keys) {
    const all = await readAll();
    const t = now();
    const out = {};
    for (const k of keys) {
      const e = all[k];
      if (e && t - e.at <= ttlMs) out[k] = e.v;
    }
    return out;
  }

  function set(entries) {
    const run = async () => {
      const all = await readAll();
      const t = now();
      let changed = false;
      for (const [k, v] of Object.entries(entries)) {
        if (v === "error") continue;
        all[k] = { at: t, v };
        changed = true;
      }
      if (!changed) return;
      const keys = Object.keys(all);
      if (keys.length > max) {
        keys.sort((a, b) => all[a].at - all[b].at);
        for (const k of keys.slice(0, keys.length - max)) delete all[k];
      }
      await storage.set({ [KEY]: all });
    };
    const p = chain.then(run);
    chain = p.catch(() => {}); // un fallo no bloquea las siguientes
    return p;
  }

  return { get, set };
}
