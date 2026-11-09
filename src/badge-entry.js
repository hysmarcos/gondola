// Entrada del content script aislado (document_start, para no perder mensajes).
import { installBadges } from "./badge.js";
import { installBridge } from "./bridge.js";
import { installCartUi } from "./cart-ui.js";
import { installPromoUi } from "./promo-ui.js";

installBadges(window, document);
installCartUi(window, document);
installPromoUi(window, document);
installBridge(window, chrome.storage.local);
