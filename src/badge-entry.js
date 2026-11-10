// Entrada del content script aislado (document_start, para no perder mensajes).
import { installBadges } from "./badge.js";
import { installBridge } from "./bridge.js";
import { createCompareClient } from "./compare-client.js";
import { installCartUi } from "./cart-ui.js";
import { installPromoUi } from "./promo-ui.js";
import { logoUrl } from "./logos.js";
import { createNutritionUi } from "./nutrition-ui.js";

// Logos de bancos: los empaquetados salen de la extensión, los nuevos del sitio de Coto.
const logo = (icono) => logoUrl(icono, (p) => chrome.runtime.getURL(p));
const compare = createCompareClient({ send: (eans) => chrome.runtime.sendMessage({ type: "compare", eans }) });

// Información nutricional: si el service worker no responde (extensión recargada), es "error".
let badges = null;
const nutrition = createNutritionUi(document, {
  request: (ean) => chrome.runtime.sendMessage({ type: "nutrition", ean }).catch(() => "error"),
  onUpdate: () => badges?.refresh(),
});

badges = installBadges(window, document, { logoUrl: logo, compare, nutrition });
installCartUi(window, document, { logoUrl: logo, compare });
installPromoUi(window, document);
installBridge(window, chrome.storage.local);
