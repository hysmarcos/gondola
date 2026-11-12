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
import { installCotoMenu } from "./coto-menu.js";

// Logos de bancos: los empaquetados salen de la extensión, los nuevos del sitio de Coto.
const logo = (icono) => logoUrl(icono, (p) => chrome.runtime.getURL(p));

// La lista de súper llega en el mensaje "settings" (badge.js y cart-ui.js se la pasan con
// setStores): nada se consulta antes de saberla, y si cambia se vuelve a pedir.
const compare = createCompareClient({
  waitForStores: true,
  send: (eans, stores) => chrome.runtime.sendMessage({ type: "compare", eans, stores }),
});

// Información nutricional: si el service worker no responde (extensión recargada), es "error".
let badges = null;
const nutritionRequest = (ean) => chrome.runtime.sendMessage({ type: "nutrition", ean }).catch(() => "error");
const nutrition = createNutritionUi(document, {
  request: nutritionRequest,
  onUpdate: () => badges?.refresh(),
  iconUrl: chrome.runtime.getURL("assets/off/off-logo-icon-light.svg"),
  assetUrl: (path) => chrome.runtime.getURL(path),
  // Con la piel de la PDP, la sección suma el interruptor 100 / porción y los números grandes.
  skin: () => document.documentElement.getAttribute("data-gondola-skin") === "pdp",
});

badges = installBadges(window, document, { logoUrl: logo, compare, nutrition });
installCartUi(window, document, {
  logoUrl: logo,
  compare,
  nutrition: { request: nutritionRequest },
  // Carrito comparado. Si el service worker no responde (extensión recargada), null.
  cartCompare: (items, stores) => chrome.runtime.sendMessage({ type: "cartCompare", items, stores }).catch(() => null),
  bankPromos: (stores) => chrome.runtime.sendMessage({ type: "bankPromos", stores }).catch(() => null),
});
installSkin(window, document, chrome.storage.local, () => badges?.refresh());
installPromoUi(window, document);
// "Configurar Góndola" en el menú de perfil de Coto. Si la extensión se recargó, no hace nada.
installCotoMenu(window, document, {
  iconUrl: chrome.runtime.getURL("assets/icon/icon.svg"),
  onOpen: () => chrome.runtime.sendMessage({ type: "openSettings" }).catch(() => {}),
});
installBridge(window, chrome.storage.local);
// Perfil personal: directo de storage, sin pasar por mensajes que la página puede leer.
installProfile(chrome.storage.local, (profile) => {
  nutrition.setProfile(profile);
  badges?.refresh();
});
