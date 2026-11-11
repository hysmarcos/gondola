import { renderWelcome } from "./welcome.js";
import { REPO } from "./feedback.js";

renderWelcome(document, {
  version: chrome.runtime.getManifest().version,
  popupUrl: chrome.runtime.getURL("popup.html"),
  privacyUrl: "https://hysmarcos.github.io/gondola/privacidad.html",
  repoUrl: REPO,
});
