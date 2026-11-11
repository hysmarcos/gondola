// Service worker. Responde a:
// - { type: "compare", eans }: precios de otros super.
// - { type: "nutrition", ean }: información nutricional de Open Food Facts.
// - { type: "openSettings" }: abre los ajustes (lo pide el menú de perfil de Coto).
// Al instalar, abre la bienvenida.
// La memoria vive en chrome.storage.local, no en variables.
import { createPriceCache } from "./price-cache.js";
import { createCompareService } from "./compare-service.js";
import { createNutritionService, NUTRI_CACHE_KEY } from "./nutrition-service.js";
import { openSettings, welcomeOnInstall } from "./lifecycle.js";

const fetch = globalThis.fetch.bind(globalThis);

const service = createCompareService({
  fetch,
  cache: createPriceCache(chrome.storage.local),
});

// La memoria de la primera ola ("nutriCache") ya no se usa.
chrome.storage.local.remove("nutriCache").catch(() => {});

const nutrition = createNutritionService({
  fetch,
  cache: createPriceCache(chrome.storage.local, Date.now, { key: NUTRI_CACHE_KEY, ttlMs: 604_800_000, max: 2000 }),
});

chrome.runtime.onInstalled.addListener((details) => welcomeOnInstall(details, chrome));

chrome.runtime.onMessage.addListener((m, _sender, reply) => {
  if (m?.type === "openSettings") {
    openSettings(chrome).then(reply, () => reply(null));
    return true;
  }
  if (m?.type === "compare") {
    service.compare(m.eans).then(reply, () => reply({}));
    return true;
  }
  if (m?.type === "nutrition") {
    nutrition.get(m.ean).then(reply, () => reply("error"));
    return true;
  }
  return undefined;
});
