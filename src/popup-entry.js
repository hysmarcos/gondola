import { renderPopup } from "./popup.js";
import { logoUrl } from "./logos.js";

renderPopup(document, chrome.storage.local, {
  version: chrome.runtime.getManifest().version,
  logoUrl: (icono) => logoUrl(icono, (p) => chrome.runtime.getURL(p)),
});
