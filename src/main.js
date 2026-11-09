// Entrada del script que corre dentro de la página (world MAIN, document_start).
import { installInterceptor } from "./interceptor.js";

installInterceptor(window, {
  fetch: window.fetch.bind(window),
  now: Date.now,
  post: (msg) => window.postMessage(msg, location.origin),
});
