// Entrada del script que corre dentro de la página (world MAIN, document_start).
import { installInterceptor } from "./interceptor.js";
import { pinInput, unpinInput } from "./pin-input.js";
import { installPromoClicks } from "./promo-clicks.js";

const api = installInterceptor(window, {
  fetch: window.fetch.bind(window),
  now: Date.now,
  post: (msg) => window.postMessage(msg, location.origin),
  // Promo 2x1 completada: el contador muestra la cantidad nueva sin pasar por la vieja.
  pin: (prodId, from, to) => pinInput(window, document, prodId, from, to),
  unpin: (prodId) => unpinInput(document, prodId),
  // Mensajes de la extensión (settings, lookup). Solo de esta misma ventana.
  listen: (fn) => window.addEventListener("message", (e) => {
    if (e.source === window) fn(e.data);
  }),
});

// "+" que completa un 2x1/3x2: suma las gratis en el mismo instante.
installPromoClicks(window, document, { dataFor: api.dataFor, enabled: api.autoPromo, notify: api.notify, expect: api.expect });
