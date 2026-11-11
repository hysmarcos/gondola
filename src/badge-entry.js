// Entrada del content script aislado (document_start, para no perder mensajes).
import { installBadges } from "./badge.js";
import { installBridge } from "./bridge.js";
import { createCompareClient } from "./compare-client.js";
import { installCartUi } from "./cart-ui.js";
import { installPromoUi } from "./promo-ui.js";
import { logoUrl } from "./logos.js";
import { createNutritionUi } from "./nutrition-ui.js";
import { installProfile } from "./profile.js";
import { installSkin } from "./skin.js";

// Logos de bancos: los empaquetados salen de la extensión, los nuevos del sitio de Coto.
const logo = (icono) => logoUrl(icono, (p) => chrome.runtime.getURL(p));
const compare = createCompareClient({ send: (eans) => chrome.runtime.sendMessage({ type: "compare", eans }) });

// Información nutricional: si el service worker no responde (extensión recargada), es "error".
let badges = null;
const nutritionRequest = (ean) => chrome.runtime.sendMessage({ type: "nutrition", ean }).catch(() => "error");
const nutrition = createNutritionUi(document, {
  request: nutritionRequest,
  onUpdate: () => badges?.refresh(),
  iconUrl: chrome.runtime.getURL("assets/off/off-logo-icon-light.svg"),
  assetUrl: (path) => chrome.runtime.getURL(path),
});

badges = installBadges(window, document, { logoUrl: logo, compare, nutrition });
installCartUi(window, document, { logoUrl: logo, compare, nutrition: { request: nutritionRequest } });
installSkin(window, document, chrome.storage.local, () => badges?.refresh());
installPromoUi(window, document);
installBridge(window, chrome.storage.local);
// Perfil personal: directo de storage, sin pasar por mensajes que la página puede leer.
installProfile(chrome.storage.local, (profile) => {
  nutrition.setProfile(profile);
  badges?.refresh();
});
