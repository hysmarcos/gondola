import { renderPopup } from "./popup.js";

renderPopup(document, chrome.storage.local, { version: chrome.runtime.getManifest().version });
