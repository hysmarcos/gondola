// Service worker: responde a { type: "compare", eans } con los precios de otros super.
// La memoria de precios vive en chrome.storage.local, no en variables.
import { createPriceCache } from "./price-cache.js";
import { createCompareService } from "./compare-service.js";

const service = createCompareService({
  fetch: globalThis.fetch.bind(globalThis),
  cache: createPriceCache(chrome.storage.local),
});

chrome.runtime.onMessage.addListener((m, _sender, reply) => {
  if (m?.type !== "compare") return undefined;
  service.compare(m.eans).then(reply, () => reply({}));
  return true;
});
