// Entrada del content script aislado (document_start, para no perder mensajes).
import { installBadges } from "./badge.js";
import { installBridge } from "./bridge.js";
import { createCompareClient } from "./compare-client.js";
import { installCartUi } from "./cart-ui.js";
import { installPromoUi } from "./promo-ui.js";

const compare = createCompareClient({ send: (eans) => chrome.runtime.sendMessage({ type: "compare", eans }) });
installBadges(window, document, { compare });
installCartUi(window, document, { compare });
installPromoUi(window, document);
installBridge(window, chrome.storage.local);
