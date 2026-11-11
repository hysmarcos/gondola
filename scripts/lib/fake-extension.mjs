// La extensión sin cargarla, para los scripts que miden Góndola en coto.com.ar
// (skin-check.mjs, theme-check.mjs): el content script de dist/ con un chrome.* de mentira, los
// assets servidos desde un host falso y lo que en la extensión hace el service worker (otros
// súper e información nutricional de Open Food Facts) corriendo acá, en Node. A Open Food Facts
// solo viaja el código de barras, como en la extensión.
import { readFile } from "node:fs/promises";
import { createCompareService } from "../../src/compare-service.js";
import { createNutritionService } from "../../src/nutrition-service.js";

export const DEV = "https://gondola.local"; // host falso: sirve assets/ (logos de bancos)

// Caché en memoria con la forma de chrome.storage.local que piden los servicios.
function memoryCache() {
  const memory = new Map();
  return {
    get: async (keys) => Object.fromEntries(keys.filter((k) => memory.has(k)).map((k) => [k, memory.get(k)])),
    set: async (o) => Object.entries(o).forEach(([k, v]) => memory.set(k, v)),
  };
}

// Los dos servicios del service worker, cada uno con su caché. Uno por corrida del script.
export function services() {
  const fetch = globalThis.fetch.bind(globalThis);
  return {
    compare: createCompareService({ fetch, cache: memoryCache() }),
    nutrition: createNutritionService({ fetch, cache: memoryCache() }),
  };
}

// Sirve assets/ del repo en el host falso; lo demás, 404.
export async function serve(route) {
  const path = new URL(route.request().url()).pathname;
  if (path.startsWith("/assets/") && !path.includes("..")) {
    const body = await readFile("." + decodeURIComponent(path)).catch(() => null);
    if (body) return route.fulfill({ body, headers: { "Access-Control-Allow-Origin": "*" }, contentType: path.endsWith(".png") ? "image/png" : path.endsWith(".svg") ? "image/svg+xml" : "application/octet-stream" });
  }
  return route.fulfill({ status: 404 });
}

// Conecta un contexto de Playwright con el host falso y con los servicios de services().
export async function connect(context, svc) {
  await context.route(DEV + "/**", serve);
  await context.exposeBinding("__gondolaCompare", (_src, eans) => svc.compare.compare(eans).catch(() => ({})));
  await context.exposeBinding("__gondolaNutrition", (_src, ean) => svc.nutrition.get(ean).catch(() => "error"));
}

// El content script (badge: el texto de dist/badge.js), con chrome.* de mentira solo para él:
// no queda en window, así Coto no ve una extensión.
//   initial: lo que el storage de mentira tiene al arrancar.
//   styles: los CSS, que van primero en la página como los de una extensión real (el CSS de
//     Coto viene después y gana los empates); styleId: el id de ese <style>.
//   exposeStorage: deja el storage en window.__gondolaStorage (para cambiarlo desde el script).
//   before: código que corre con <html> ya creado, antes de los estilos y del content script.
export function injection({ badge, styles, styleId, initial = {}, exposeStorage = false, before = "" }) {
  return `(() => {
  const data = ${JSON.stringify(initial)};
  const listeners = [];
  const local = {
    get: async (keys) => Object.fromEntries([].concat(keys).filter((k) => k in data).map((k) => [k, data[k]])),
    set: async (o) => { Object.assign(data, o); const ch = Object.fromEntries(Object.entries(o).map(([k, v]) => [k, { newValue: v }])); listeners.forEach((f) => f(ch)); },
    remove: async () => {},
    onChanged: { addListener: (f) => listeners.push(f) },
  };
  const chrome = {
    runtime: {
      getURL: (p) => ${JSON.stringify(DEV)} + "/" + p,
      sendMessage: (m) => m && m.type === "compare" ? window.__gondolaCompare(m.eans) : m && m.type === "nutrition" ? window.__gondolaNutrition(m.ean) : Promise.resolve("error"),
    },
    storage: { local },
  };
  ${exposeStorage ? "window.__gondolaStorage = local;" : ""}
  const start = () => {
    if (!document.documentElement) return setTimeout(start, 0);
    ${before}
    const style = document.createElement("style");
    style.id = ${JSON.stringify(styleId)};
    style.textContent = ${JSON.stringify(styles)};
    (document.head ?? document.documentElement).prepend(style);
    (function (chrome) { ${badge} })(chrome);
  };
  start();
})();`;
}
