import { renderPopup } from "./popup.js";
import { logoUrl } from "./logos.js";
import { enabledStores } from "./stores.js";
import { promoEntries } from "./bank-rules/index.js";

// popup.html?page=1 es el mismo menú abierto como página. tab y section eligen dónde abre.
const params = new URLSearchParams(location.search);
if (params.has("page")) document.documentElement.dataset.page = "";

const meta = {
  version: chrome.runtime.getManifest().version,
  logoUrl: (icono) => logoUrl(icono, (p) => chrome.runtime.getURL(p)),
  welcomeUrl: chrome.runtime.getURL("welcome.html"),
  tab: params.get("tab") ?? undefined,
  section: params.get("section") ?? undefined,
};

const render = () => renderPopup(document, chrome.storage.local, meta);

// Al volver a dibujar se queda en la pestaña que está abierta.
const redraw = () => {
  const tab = document.querySelector('[role="tab"][aria-selected="true"]')?.id.replace(/^tab-/, "");
  if (tab) Object.assign(meta, { tab, section: undefined });
  return render();
};

render();

// Primero se dibuja sin las promos de los otros súper; cuando llegan, se vuelve a dibujar.
chrome.storage.local
  .get(["compareStores", "storesOff"])
  .then(async (s) => {
    const stores = enabledStores(s);
    if (!stores.length) return;
    const res = await chrome.runtime.sendMessage({ type: "bankPromos", stores: stores.map((st) => st.id) });
    if (!res || typeof res !== "object") return;
    const shown = stores.filter((st) => st.id in res);
    meta.stores = shown;
    meta.storePromos = Object.fromEntries(shown.map((st) => [st.id, promoEntries(st.id, res[st.id])]));
    await redraw();
  })
  .catch(() => {});

// Las promos llegan cuando se abre Coto: si el menú estaba abierto y vacío, se vuelve a dibujar.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.promos && !(changes.promos.oldValue ?? []).length) redraw();
});
