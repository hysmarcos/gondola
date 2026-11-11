import { renderPopup } from "./popup.js";
import { logoUrl } from "./logos.js";

// popup.html?page=1 es el mismo menú abierto como página. tab y section eligen dónde abre.
const params = new URLSearchParams(location.search);
if (params.has("page")) document.documentElement.dataset.page = "";

const render = () => renderPopup(document, chrome.storage.local, {
  version: chrome.runtime.getManifest().version,
  logoUrl: (icono) => logoUrl(icono, (p) => chrome.runtime.getURL(p)),
  welcomeUrl: chrome.runtime.getURL("welcome.html"),
  tab: params.get("tab") ?? undefined,
  section: params.get("section") ?? undefined,
});
render();

// Las promos llegan cuando se abre Coto: si el menú estaba abierto y vacío, se vuelve a dibujar.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.promos && !(changes.promos.oldValue ?? []).length) render();
});
