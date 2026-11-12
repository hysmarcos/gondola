// Entrada del content script aislado (document_start, para no perder mensajes).
import { installTheme } from "./theme.js";
import { installBadges } from "./badge.js";
import { installBridge } from "./bridge.js";
import { createCompareClient } from "./compare-client.js";
import { installCartUi } from "./cart-ui.js";
import { installPromoUi } from "./promo-ui.js";
import { logoUrl } from "./logos.js";
import { storeLogoUrl } from "./stores.js";
import { createNutritionUi } from "./nutrition-ui.js";
import { installProfile } from "./profile.js";
import { installSkin } from "./skin.js";
import { installCotoMenu } from "./coto-menu.js";
import { installQtyAnim } from "./qty-anim.js";

// El tema va primero: tiene que correr antes de que la página se dibuje.
installTheme(window, document, chrome.storage.local);

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
  // Con la piel de la PDP, la sección suma el interruptor 100 / porción y los números grandes.
  skin: () => document.documentElement.getAttribute("data-gondola-skin") === "pdp",
});

// Logos de los súper del comparador: siempre empaquetados, nada se pide a otros sitios.
const storeLogo = (id) => storeLogoUrl(id, (p) => chrome.runtime.getURL(p));
badges = installBadges(window, document, { logoUrl: logo, storeLogo, compare, nutrition });
installCartUi(window, document, { logoUrl: logo, storeLogo, compare, nutrition: { request: nutritionRequest } });
installSkin(window, document, chrome.storage.local, () => badges?.refresh());
installPromoUi(window, document);
// El número del contador de cantidad se anima al cambiar por un clic en − o +.
installQtyAnim(window, document);
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
