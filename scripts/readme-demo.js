// Demo en vivo sobre coto.com.ar, solo para las capturas del README: la extensión completa,
// con la comparación por el relevo local y ajustes en memoria.
import { installInterceptor } from "../src/interceptor.js";
import { installBadges } from "../src/badge.js";
import { installCartUi } from "../src/cart-ui.js";
import { installPromoUi } from "../src/promo-ui.js";
import { installBridge } from "../src/bridge.js";
import { createCompareClient } from "../src/compare-client.js";
import { createCompareService } from "../src/compare-service.js";
import { logoUrl } from "../src/logos.js";
// Los colores de badge.css salen de los tokens --g-* de theme.css: va primero.
import themeCss from "../src/theme.css";
import css from "../src/badge.css";

// Base de logos y relevo: la pone el script de capturas (o el servidor local por defecto).
const DEV = window.__gondolaDev ?? "http://127.0.0.1:8765";
if (!window.__gondolaDemo && window.top === window) {
  window.__gondolaDemo = true;
  const s = document.createElement("style");
  s.textContent = themeCss + "\n" + css.replaceAll("../assets/", DEV + "/assets/");
  // Al empezar la página todavía no hay documento: el estilo entra apenas exista.
  const addStyle = () => (document.head ?? document.documentElement).append(s);
  if (document.documentElement) addStyle(); else document.addEventListener("readystatechange", addStyle, { once: true });
  const data = window.__cotoSettings ?? {};
  const ls = [];
  const storage = { get: async (k) => Object.fromEntries(k.filter((x) => x in data).map((x) => [x, data[x]])), set: async (o) => { Object.assign(data, o); ls.forEach((f) => f(o)); }, onChanged: { addListener: (f) => ls.push(f) } };
  window.__cotoStorage = storage;
  const memory = new Map();
  const service = createCompareService({
    fetch: (url, init = {}) => fetch(DEV + "/proxy?url=" + encodeURIComponent(String(url)), { method: init.method ?? "GET", body: init.body }),
    cache: { get: async (keys) => Object.fromEntries(keys.filter((k) => memory.has(k)).map((k) => [k, memory.get(k)])), set: async (o) => Object.entries(o).forEach(([k, v]) => memory.set(k, v)) },
  });
  const compare = createCompareClient({ send: (eans) => service.compare(eans) });
  const logo = (icono) => logoUrl(icono, (p) => DEV + "/" + p);
  installInterceptor(window, { fetch: window.fetch.bind(window), now: Date.now, post: (m) => window.postMessage(m, location.origin), listen: (fn) => window.addEventListener("message", (e) => { if (e.source === window) fn(e.data); }) });
  installBridge(window, storage);
  // La interfaz necesita el documento; en una extensión ya existe al empezar, acá no siempre.
  const ui = () => {
    if (!document.documentElement) return setTimeout(ui, 0);
    installBadges(window, document, { logoUrl: logo, compare });
    installCartUi(window, document, { logoUrl: logo, compare });
    installPromoUi(window, document);
  };
  ui();
}
