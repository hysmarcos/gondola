// Entrada del content script aislado (document_start, para no perder mensajes).
import { installBadges } from "./badge.js";
import { installBridge } from "./bridge.js";
import { installCartUi } from "./cart-ui.js";
import { installPromoUi } from "./promo-ui.js";
import { logoUrl } from "./logos.js";

// Logos de bancos: los empaquetados salen de la extensión, los nuevos del sitio de Coto.
const logo = (icono) => logoUrl(icono, (p) => chrome.runtime.getURL(p));

installBadges(window, document, { logoUrl: logo });
installCartUi(window, document, { logoUrl: logo });
installPromoUi(window, document);
installBridge(window, chrome.storage.local);
