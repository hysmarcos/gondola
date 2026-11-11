// Mide la piel Góndola en coto.com.ar: en cada fila de la grilla, el nombre, el precio y el
// botón quedan a la misma altura y ninguna tarjeta queda más alta que otra.
// Uso: npm run build && npm run skin:check
//   Coto bloquea el Chrome sin ventana, así que abre Chrome visible: no tocar la ventana
//   mientras corre. CHROME_PATH=ruta a Chrome si Playwright no encuentra el instalado.
//   SHOTS=<carpeta>: guarda una captura de la lista por tamaño.
//   ONLY=1280x900: mide un solo tamaño.
// Sin la extensión cargada y sin sesión: inyecta dist/ (con un chrome.* de mentira, como
// scripts/capture-readme.mjs) y los CSS de la piel, y pone data-gondola-skin="list" a mano.
import { readFile, mkdir } from "node:fs/promises";
import { chromium } from "playwright";
import { createCompareService } from "../src/compare-service.js";

const BASE = "https://www.coto.com.ar";
const PAGES = [
  { name: "Leches", url: `${BASE}/productos/categorias/catalogo-frescos-l%C3%A1cteos/leches/catv00003266` },
  // Búsqueda mixta: trae productos sin precio por unidad (tarjetas sin etiqueta de Góndola).
  { name: "Búsqueda \"pack\"", url: `${BASE}/productos/busqueda?search=pack` },
];
const SIZES = [
  { name: "1280x900", viewport: { width: 1280, height: 900 }, scale: 1 },
  { name: "1920x1080", viewport: { width: 1920, height: 1080 }, scale: 1 },
  // Zoom del navegador al 150 %: la ventana de 1280 × 900 deja 853 × 600 px de CSS.
  { name: "1280x900 zoom 1,5", viewport: { width: 853, height: 600 }, scale: 1.5 },
].filter((s) => !process.env.ONLY || s.name === process.env.ONLY);
const CSS = ["src/badge.css", "src/skin.css", "src/skin-list.css"];
const DEV = "https://gondola.local"; // host falso: sirve assets/ (logos de bancos)
const TOLERANCE = 1;

// Lo que en la extensión hace el service worker: pedir precios a otros súper.
const memory = new Map();
const compareService = createCompareService({
  fetch: globalThis.fetch.bind(globalThis),
  cache: {
    get: async (keys) => Object.fromEntries(keys.filter((k) => memory.has(k)).map((k) => [k, memory.get(k)])),
    set: async (o) => Object.entries(o).forEach(([k, v]) => memory.set(k, v)),
  },
});

async function serve(route) {
  const path = new URL(route.request().url()).pathname;
  if (path.startsWith("/assets/") && !path.includes("..")) {
    const body = await readFile("." + decodeURIComponent(path)).catch(() => null);
    if (body) return route.fulfill({ body, headers: { "Access-Control-Allow-Origin": "*" }, contentType: path.endsWith(".png") ? "image/png" : path.endsWith(".svg") ? "image/svg+xml" : "application/octet-stream" });
  }
  return route.fulfill({ status: 404 });
}

// El content script de la extensión, con chrome.* de mentira solo para él (no queda en
// window, así Coto no ve una extensión). El ajuste "skin" queda prendido.
function injection(badge, styles) {
  return `(() => {
  const data = {};
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
      sendMessage: (m) => m && m.type === "compare" ? window.__gondolaCompare(m.eans) : Promise.resolve("error"),
    },
    storage: { local },
  };
  window.__gondolaStorage = local;
  const start = () => {
    if (!document.documentElement) return setTimeout(start, 0);
    document.documentElement.setAttribute("data-gondola-skin", "list");
    const style = document.createElement("style");
    style.id = "gondola-skin-check";
    style.textContent = ${JSON.stringify(styles)};
    (document.head ?? document.documentElement).append(style);
    (function (chrome) { ${badge} })(chrome);
  };
  start();
})();`;
}

// Medidas de cada tarjeta, agrupadas en filas por el borde de arriba de su celda.
function measure() {
  const top = (el) => (el ? Math.round(el.getBoundingClientRect().top * 10) / 10 : null);
  const visible = (el) => el && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== "hidden";
  const cut = (el) => (el ? el.scrollWidth > el.clientWidth + 0.5 : false);
  const cards = [];
  for (const cell of document.querySelectorAll(".productos > .producto-card")) {
    const card = cell.querySelector(".card-container");
    if (!card || !visible(card)) continue;
    const labelled = card.hasAttribute("data-coto-unit-card");
    const price = labelled
      ? card.querySelector(".coto-unit-pricerow")
      : [...card.querySelectorAll(".centro-precios h4.card-title")].find(visible);
    const button = card.querySelector(".bottom-botones product-add-show-remove");
    const action = card.querySelector(".bottom-botones product-add-show-remove .btn-primary, .bottom-botones product-add-show-remove input");
    cards.push({
      name: card.querySelector(".nombre-producto")?.textContent.trim().slice(0, 40),
      labelled,
      cell: top(cell),
      top: { nombre: top(card.querySelector(".nombre-producto")), precio: top(price), botón: top(button) },
      alto: Math.round(card.getBoundingClientRect().height * 10) / 10,
      cortado: [cut(price) && "precio", cut(action) && "botón"].filter(Boolean),
    });
  }
  return cards;
}

function rows(cards) {
  const out = [];
  for (const c of [...cards].sort((a, b) => a.cell - b.cell)) {
    const row = out.find((r) => Math.abs(r[0].cell - c.cell) <= 2);
    if (row) row.push(c);
    else out.push([c]);
  }
  return out;
}

const spread = (values) => Math.max(...values) - Math.min(...values);

// Diferencias de una fila, en texto. Vacío si la fila está pareja.
function check(row, i) {
  const problems = [];
  const labelled = row.filter((c) => c.labelled);
  if (labelled.length > 1) {
    for (const key of ["nombre", "precio", "botón"]) {
      const d = spread(labelled.map((c) => c.top[key]));
      if (d > TOLERANCE) problems.push(`fila ${i + 1}: ${key} difiere ${d.toFixed(1)} px entre tarjetas con etiqueta`);
    }
  }
  const h = spread(row.map((c) => c.alto));
  if (h > TOLERANCE) problems.push(`fila ${i + 1}: alto de tarjeta difiere ${h.toFixed(1)} px (${row.map((c) => c.alto).join(", ")})`);
  if (row.some((c) => !c.labelled) && row.length > 1) {
    const d = spread(row.map((c) => c.top.botón));
    if (d > TOLERANCE) problems.push(`fila ${i + 1}: botón de una tarjeta sin etiqueta difiere ${d.toFixed(1)} px de sus vecinas`);
  }
  for (const c of row) if (c.cortado.length) problems.push(`fila ${i + 1}: "${c.name}": ${c.cortado.join(" y ")} cortado`);
  return problems;
}

const shots = process.env.SHOTS;
if (shots) await mkdir(shots, { recursive: true });
const badge = await readFile("dist/badge.js", "utf8");
const interceptor = await readFile("dist/interceptor.js", "utf8");
const styles = (await Promise.all(CSS.map((f) => readFile(f, "utf8")))).join("\n");

const browser = await chromium.launch({ channel: process.env.CHROME_PATH ? undefined : "chrome", executablePath: process.env.CHROME_PATH || undefined, headless: false });
let failed = false;
let unlabelledSeen = 0;
try {
  for (const pg of PAGES) {
    console.log(pg.name);
    for (const size of SIZES) {
      const context = await browser.newContext({ viewport: size.viewport, deviceScaleFactor: size.scale, locale: "es-AR" });
      await context.route(DEV + "/**", serve);
      await context.exposeBinding("__gondolaCompare", (_src, eans) => compareService.compare(eans).catch(() => ({})));
      await context.addInitScript({ content: interceptor });
      await context.addInitScript({ content: injection(badge, styles) });
      const page = await context.newPage();
      try {
        await page.goto(pg.url, { waitUntil: "domcontentloaded" });
        await page.waitForSelector(".card-container", { timeout: 45000 });
        await page.waitForSelector("[data-coto-unit-card]", { timeout: 30000 });
        // Baja por la lista para que cada tarjeta pida su comparación, y vuelve arriba.
        for (let y = 0; y < 6; y++) {
          await page.mouse.wheel(0, size.viewport.height);
          await page.waitForTimeout(500);
        }
        await page.waitForTimeout(2500);
        await page.evaluate(() => scrollTo(0, 0));
        await page.waitForTimeout(500);
        const all = rows(await page.evaluate(measure));
        const unlabelled = all.flat().filter((c) => !c.labelled).length;
        unlabelledSeen += unlabelled;
        const problems = all.flatMap(check);
        const extra = unlabelled ? ` (${unlabelled} sin etiqueta)` : " (ninguna tarjeta sin etiqueta)";
        if (problems.length) {
          failed = true;
          console.log(`${size.name}: ${all.length} filas${extra}:\n  ${problems.join("\n  ")}`);
        } else {
          console.log(`${size.name}: ${all.length} filas, alineadas${extra}`);
        }
        if (shots) {
          // La grilla arriba, debajo del encabezado fijo de Coto.
          await page.evaluate(() => {
            const header = document.querySelector("app-header")?.getBoundingClientRect().height ?? 0;
            scrollTo(0, document.querySelector(".productos").getBoundingClientRect().top + scrollY - header - 16);
          });
          await page.waitForTimeout(400);
          await page.screenshot({ path: `${shots}/${PAGES.indexOf(pg) + 1}-${size.name.replace(/[ ,]+/g, "-")}.png` });
        }
      } catch (e) {
        failed = true;
        console.log(`${size.name}: no se pudo medir: ${e.message.split("\n")[0]}`);
      } finally {
        await context.close();
      }
    }
  }
} finally {
  await browser.close();
}
if (!unlabelledSeen) console.log("Aviso: ninguna página trajo una tarjeta sin etiqueta de Góndola; el punto 2 de Review Focus no quedó medido.");
process.exit(failed ? 1 : 0);
