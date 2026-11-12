// Service worker. Responde a:
// - { type: "compare", eans, stores }: precios de otros super.
// - { type: "nutrition", ean }: información nutricional de Open Food Facts.
// - { type: "bankPromos", stores }: promos de banco online de otros súper.
// - { type: "openSettings" }: abre los ajustes (lo pide el menú de perfil de Coto).
// Al instalar, abre la bienvenida.
// La memoria vive en chrome.storage.local, no en variables.
import { createPriceCache } from "./price-cache.js";
import { createCompareService } from "./compare-service.js";
import { createNutritionService, NUTRI_CACHE_KEY } from "./nutrition-service.js";
import { createBankPromosService } from "./bank-promos/service.js";
import { openSettings, welcomeOnInstall } from "./lifecycle.js";

const fetch = globalThis.fetch.bind(globalThis);

// storeStatus: { [storeId]: "error" }. Solo guarda los que fallan.
async function setStoreStatus(id, ok) {
  try {
    const { storeStatus } = await chrome.storage.local.get("storeStatus");
    const next = { ...(storeStatus ?? {}) };
    if (ok) delete next[id];
    else next[id] = "error";
    // Solo escribe si algo cambió.
    if (JSON.stringify(next) !== JSON.stringify(storeStatus ?? {})) await chrome.storage.local.set({ storeStatus: next });
  } catch {
    // sin estado igual se compara
  }
}

const service = createCompareService({
  fetch,
  cache: createPriceCache(chrome.storage.local),
  // El popup avisa qué súper no responde.
  onStatus: (id, ok) => setStoreStatus(id, ok),
});

// La memoria de la primera ola ("nutriCache") ya no se usa.
chrome.storage.local.remove("nutriCache").catch(() => {});

const nutrition = createNutritionService({
  fetch,
  cache: createPriceCache(chrome.storage.local, Date.now, { key: NUTRI_CACHE_KEY, ttlMs: 604_800_000, max: 2000 }),
});

const bankPromos = createBankPromosService({
  fetch,
  cache: createPriceCache(chrome.storage.local, Date.now, { key: "bankPromosCache", ttlMs: 86_400_000, max: 10 }),
});

chrome.runtime.onInstalled.addListener((details) => welcomeOnInstall(details, chrome));

chrome.runtime.onMessage.addListener((m, _sender, reply) => {
  if (m?.type === "openSettings") {
    openSettings(chrome).then(reply, () => reply(null));
    return true;
  }
  if (m?.type === "compare") {
    service.compare(m.eans, m.stores).then(reply, () => reply({}));
    return true;
  }
  if (m?.type === "nutrition") {
    nutrition.get(m.ean).then(reply, () => reply("error"));
    return true;
  }
  if (m?.type === "bankPromos") {
    bankPromos.get(m.stores).then(reply, () => reply({}));
    return true;
  }
  return undefined;
});
