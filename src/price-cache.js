// Memoria con vencimiento en chrome.storage.local. Guarda todo bajo `key` como
// { [clave]: { at, v } }. Por defecto es la de precios de otros súper (`cmpCache`,
// 6 h, clave "<storeId>:<ean>"); la información nutricional usa `nutriCache`.
// `storage` tiene la forma de chrome.storage.local.
export function createPriceCache(storage, now = Date.now, { key: KEY = "cmpCache", ttlMs = 21_600_000, max = 3000 } = {}) {
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
