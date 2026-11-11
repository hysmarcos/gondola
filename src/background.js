// Service worker. Responde a:
// - { type: "compare", eans }: precios de otros super.
// - { type: "nutrition", ean }: información nutricional de Open Food Facts.
// La memoria vive en chrome.storage.local, no en variables.
import { createPriceCache } from "./price-cache.js";
import { createCompareService } from "./compare-service.js";
import { createNutritionService } from "./nutrition-service.js";

const fetch = globalThis.fetch.bind(globalThis);

const service = createCompareService({
  fetch,
  cache: createPriceCache(chrome.storage.local),
});

const nutrition = createNutritionService({
  fetch,
  cache: createPriceCache(chrome.storage.local, Date.now, { key: "nutriCache", ttlMs: 604_800_000, max: 2000 }),
});

chrome.runtime.onMessage.addListener((m, _sender, reply) => {
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
