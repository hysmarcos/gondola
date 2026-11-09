// Entrada del script que corre dentro de la página (world MAIN, document_start).
import { installInterceptor } from "./interceptor.js";

installInterceptor(window, {
  fetch: window.fetch.bind(window),
  now: Date.now,
  post: (msg) => window.postMessage(msg, location.origin),
  // Mensajes de la extensión (settings, lookup). Solo de esta misma ventana.
  listen: (fn) => window.addEventListener("message", (e) => {
    if (e.source === window) fn(e.data);
  }),
});
