// Revisa el modo oscuro en coto.com.ar: abre inicio, una lista, una página de producto y
// /carrito con la extensión construida y theme: "dark", baja hasta el final y busca:
// - bloques claros: elementos visibles de más de 2.000 px² con fondo de luminancia > 0,6
//   (no cuentan las imágenes, lo que está sobre la placa --g-plate ni los banners de publicidad);
// - textos con poco contraste contra su fondo efectivo: menos de 4,5:1 (3:1 en texto grande);
// - el logo de Coto: dibujado en un canvas con su filtro, ningún píxel opaco es rojo.
// Imprime cada hallazgo (componente de Coto, selector corto, tamaño y color) y sale con 1 si hay alguno.
// Uso: npm run build && npm run theme:check
//   Coto bloquea el Chrome sin ventana, así que abre Chrome visible: no tocar la ventana
//   mientras corre. CHROME_PATH=ruta a Chrome si Playwright no encuentra el instalado.
//   URL=<dirección de coto.com.ar>: revisa solo esa página.
//   SHOTS=<carpeta>: guarda dos capturas por página (arriba y al final) y una con el menú de
//   categorías abierto (en la primera página).
//   SKIN=off: con el Diseño Góndola apagado (el modo oscuro no depende de la piel).
// Sin la extensión cargada y sin sesión: inyecta dist/ con un chrome.* de mentira, como
// scripts/skin-check.mjs, y los CSS de manifest.json en su orden. Nunca inicia sesión ni
// escribe en la página: solo baja y abre el menú de categorías con un clic.
import { readFile, mkdir } from "node:fs/promises";
import { chromium } from "playwright";
import { createCompareService } from "../src/compare-service.js";
import { createNutritionService } from "../src/nutrition-service.js";

const BASE = "https://www.coto.com.ar";
// Las mismas páginas de ejemplo que scripts/capture-dom.mjs.
const LIST_URL = `${BASE}/productos/categorias/catalogo-frescos-l%C3%A1cteos/leches/catv00003266?filters%5Bproduct_brand%5D=LA%20SERENISIMA`;
const PDP_URL = `${BASE}/productos/leche-protein-la-serenisima-1l-/_/R-00508911-00508911-200`;
const PAGES = process.env.URL ? [{ name: "pagina", url: process.env.URL }] : [
  { name: "inicio", url: `${BASE}/` },
  { name: "lista", url: LIST_URL },
  { name: "producto", url: PDP_URL },
  { name: "carrito", url: `${BASE}/carrito` },
];
const VIEW = { width: 1280, height: 900 };
const DEV = "https://gondola.local"; // host falso: sirve assets/ (logos de bancos)
const MIN_AREA = 2000; // px²
const MAX_LUMINANCE = 0.6;
// Banners de publicidad de Coto: son imágenes y quedan como son (spec, fuera de alcance).
const ADS = "category-banner, .category-banner, app-banner, .banner, .carousel-banner";
// Los CSS del content script de Coto, en el orden de manifest.json.
const manifest = JSON.parse(await readFile("manifest.json", "utf8"));
const CSS = manifest.content_scripts.find((c) => c.css).css;

const memory = new Map();
const compareService = createCompareService({
  fetch: globalThis.fetch.bind(globalThis),
  cache: {
    get: async (keys) => Object.fromEntries(keys.filter((k) => memory.has(k)).map((k) => [k, memory.get(k)])),
    set: async (o) => Object.entries(o).forEach(([k, v]) => memory.set(k, v)),
  },
});
const nutritionMemory = new Map();
const nutritionService = createNutritionService({
  fetch: globalThis.fetch.bind(globalThis),
  cache: {
    get: async (keys) => Object.fromEntries(keys.filter((k) => nutritionMemory.has(k)).map((k) => [k, nutritionMemory.get(k)])),
    set: async (o) => Object.entries(o).forEach(([k, v]) => nutritionMemory.set(k, v)),
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

// El content script con chrome.* de mentira solo para él. El storage arranca con el tema
// oscuro (y la piel apagada con SKIN=off); src/theme.js y src/skin.js ponen sus atributos solos.
function injection(badge, styles, initial) {
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
  const start = () => {
    if (!document.documentElement) return setTimeout(start, 0);
    const style = document.createElement("style");
    style.id = "gondola-theme-check";
    style.textContent = ${JSON.stringify(styles)};
    // Primero en la página, como el CSS de una extensión real: el de Coto gana los empates.
    (document.head ?? document.documentElement).prepend(style);
    (function (chrome) { ${badge} })(chrome);
  };
  start();
})();`;
}

// Corre en la página. Devuelve los bloques claros y los textos con poco contraste de
// root (todo el documento o una parte, como el menú abierto).
function findings({ rootSelector, ads, minArea, maxLum }) {
  const root = rootSelector ? document.querySelector(rootSelector) : document.body;
  if (!root) return { light: [], text: [] };
  const rgba = (s) => {
    const m = s.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const [r, g, b, a = 1] = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
    return { r, g, b, a };
  };
  const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  const lum = (c) => 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
  const over = (top, bottom) => ({ r: top.r * top.a + bottom.r * (1 - top.a), g: top.g * top.a + bottom.g * (1 - top.a), b: top.b * top.a + bottom.b * (1 - top.a), a: 1 });
  const ratio = (x, y) => { const [h, l] = [lum(x), lum(y)].sort((p, q) => q - p); return (h + 0.05) / (l + 0.05); };
  // Color de --g-plate ya resuelto, para reconocer lo que va sobre la placa.
  const probe = document.createElement("div");
  probe.style.background = "var(--g-plate)";
  document.body.append(probe);
  const plate = getComputedStyle(probe).backgroundColor;
  probe.remove();
  const onPlate = (el) => {
    for (let e = el; e; e = e.parentElement) if (getComputedStyle(e).backgroundColor === plate) return true;
    return false;
  };
  const shown = (el) => el.getClientRects().length > 0 && el.checkVisibility({ opacityProperty: true, visibilityProperty: true });
  const name = (el) => {
    const cls = [...el.classList].filter((c) => !/^ng-/.test(c)).slice(0, 2);
    // El id solo si no hay clases: los de Coto suelen ser datos (#Almacén) y separarían grupos iguales.
    return el.tagName.toLowerCase() + (el.id && !cls.length ? `#${el.id}` : "") + cls.map((c) => `.${c}`).join("");
  };
  // Selector corto: el componente de Coto más cercano (etiqueta con guion), el padre y el nodo.
  const where = (el) => {
    let comp = el.parentElement;
    while (comp && !comp.tagName.includes("-")) comp = comp.parentElement;
    const parent = el.parentElement && el.parentElement !== comp ? `${name(el.parentElement)} > ` : "";
    return `${comp ? `[${comp.tagName.toLowerCase()}] ` : ""}${parent}${name(el)}`;
  };
  // Fondo efectivo: sube por los padres sumando capas hasta una opaca. null si en el camino
  // hay una imagen de fondo (no se puede saber el color).
  const backdrop = (el) => {
    const layers = [];
    for (let e = el; e; e = e.parentElement) {
      const cs = getComputedStyle(e);
      if (cs.backgroundImage !== "none") return null;
      const c = rgba(cs.backgroundColor);
      if (c && c.a > 0) layers.push(c);
      if (c && c.a >= 1) break;
    }
    let base = { r: 255, g: 255, b: 255, a: 1 };
    if (!layers.length || layers.at(-1).a < 1) base = rgba(getComputedStyle(document.documentElement).backgroundColor) ?? base;
    return layers.reverse().reduce((acc, c) => over(c, acc), base);
  };

  const light = [];
  for (const el of [root, ...root.querySelectorAll("*")]) {
    if (/^(IMG|PICTURE|VIDEO|CANVAS|IFRAME|SVG|svg|path)$/.test(el.tagName) || el.closest(ads) || !shown(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.width * r.height <= minArea) continue;
    const bg = rgba(getComputedStyle(el).backgroundColor);
    if (!bg || bg.a < 0.5 || lum(bg) <= maxLum) continue;
    if (onPlate(el)) continue;
    light.push({ where: where(el), size: `${Math.round(r.width)}×${Math.round(r.height)}`, color: getComputedStyle(el).backgroundColor });
  }

  const text = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const seen = new Set();
  while (walker.nextNode()) {
    const el = walker.currentNode.parentElement;
    if (!el || seen.has(el) || !walker.currentNode.textContent.trim()) continue;
    seen.add(el);
    if (/^(SCRIPT|STYLE|NOSCRIPT|OPTION)$/.test(el.tagName) || el.closest(ads) || !shown(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue; // texto solo para lectores de pantalla
    const cs = getComputedStyle(el);
    const fg = rgba(cs.color);
    const bg = backdrop(el);
    if (!fg || !bg) continue;
    const size = parseFloat(cs.fontSize);
    const large = size >= 24 || (size >= 18.66 && Number(cs.fontWeight) >= 700);
    const min = large ? 3 : 4.5;
    const c = ratio(over(fg, bg), bg);
    if (c >= min) continue;
    const toRgb = (x) => `rgb(${[x.r, x.g, x.b].map(Math.round).join(", ")})`;
    text.push({ where: where(el), size: `${Math.round(r.width)}×${Math.round(r.height)}`, color: `${cs.color} sobre ${toRgb(bg)}`, ratio: c.toFixed(2), text: walker.currentNode.textContent.trim().slice(0, 30) });
  }
  return { light, text };
}

// Agrupa hallazgos iguales (mismo lugar y color) y los imprime.
function report(label, list, fmt) {
  const groups = new Map();
  for (const f of list) {
    const key = `${f.where}|${f.color}`;
    const g = groups.get(key);
    if (g) g.n++;
    else groups.set(key, { ...f, n: 1 });
  }
  for (const g of groups.values()) console.log(`  ${label}: ${fmt(g)}${g.n > 1 ? ` (×${g.n})` : ""}`);
  return groups.size;
}

// El logo, dibujado en un canvas con el filtro que tiene en la página: cuenta los píxeles
// opacos rojos (R > 150, G y B < 90). La imagen se baja desde Node para no ensuciar el canvas.
async function checkLogo(page) {
  const info = await page.evaluate(() => {
    const img = document.querySelector("img.img-logo-coto");
    if (!img) return null;
    return { src: img.currentSrc || img.src, filter: getComputedStyle(img).filter, w: img.naturalWidth || img.width, h: img.naturalHeight || img.height };
  });
  if (!info) return "no está img.img-logo-coto";
  const res = await page.request.get(info.src);
  if (!res.ok()) return `no se pudo bajar el logo (${res.status()})`;
  const type = res.headers()["content-type"] || (info.src.endsWith(".svg") ? "image/svg+xml" : "image/png");
  const data = `data:${type};base64,${(await res.body()).toString("base64")}`;
  const red = await page.evaluate(async ({ data, filter, w, h }) => {
    const img = new Image();
    img.src = data;
    await img.decode();
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, w || img.width) * 2;
    canvas.height = Math.max(1, h || img.height) * 2;
    const ctx = canvas.getContext("2d");
    ctx.filter = filter === "none" ? "none" : filter;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const px = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let red = 0;
    let opaque = 0;
    for (let i = 0; i < px.length; i += 4) {
      if (px[i + 3] === 0) continue;
      opaque++;
      if (px[i] > 150 && px[i + 1] < 90 && px[i + 2] < 90) red++;
    }
    return { red, opaque };
  }, { data, filter: info.filter, w: info.w, h: info.h });
  if (!red.opaque) return "el logo no tiene píxeles opacos";
  return red.red ? `el logo tiene ${red.red} píxeles rojos de ${red.opaque} (filtro: ${info.filter})` : null;
}

// Baja hasta el final de a una pantalla, para que carguen las partes perezosas.
async function scrollToEnd(page) {
  for (let i = 0; i < 40; i++) {
    const done = await page.evaluate(() => innerHeight + scrollY >= document.documentElement.scrollHeight - 2);
    if (done) break;
    await page.mouse.wheel(0, VIEW.height);
    await page.waitForTimeout(400);
  }
  await page.waitForTimeout(1500);
}

async function checkPage(page, pg, first) {
  let count = 0;
  await page.goto(pg.url, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("html[data-gondola-theme=dark]", { timeout: 20000 });
  await page.waitForSelector("header.section-header, app-header header", { timeout: 45000 });
  await page.waitForLoadState("load", { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(3000);
  if (shots) await page.screenshot({ path: `${shots}/${pg.name}-arriba.png` });
  const logo = await checkLogo(page);
  if (logo) {
    count++;
    console.log(`  logo: ${logo}`);
  } else console.log("  logo: sin rojo");
  await scrollToEnd(page);
  if (shots) await page.screenshot({ path: `${shots}/${pg.name}-final.png` });
  const f = await page.evaluate(findings, { rootSelector: null, ads: ADS, minArea: MIN_AREA, maxLum: MAX_LUMINANCE });
  count += report("bloque claro", f.light, (g) => `${g.where} ${g.size} fondo ${g.color}`);
  count += report("contraste", f.text, (g) => `${g.where} ${g.size} ${g.color} = ${g.ratio}:1 "${g.text}"`);
  if (first) count += await checkMenu(page, pg);
  return count;
}

// Menú de categorías: abre la primera categoría con un clic y revisa el panel abierto.
async function checkMenu(page, pg) {
  await page.evaluate(() => scrollTo(0, 0));
  await page.waitForTimeout(400);
  const item = page.locator("header-category .categorias-generales").first();
  if (!(await item.count())) {
    console.log("  menú: no está header-category (no se revisó)");
    return 0;
  }
  await item.click();
  const open = await page.waitForSelector("header-category .detalle-categoria", { state: "visible", timeout: 5000 }).then(() => true, () => false);
  if (!open) {
    console.log("  menú: el clic no abrió .detalle-categoria (no se revisó)");
    return 0;
  }
  await page.waitForTimeout(800);
  if (shots) await page.screenshot({ path: `${shots}/${pg.name}-menu.png` });
  const f = await page.evaluate(findings, { rootSelector: "header-category", ads: ADS, minArea: MIN_AREA, maxLum: MAX_LUMINANCE });
  const n = report("menú, bloque claro", f.light, (g) => `${g.where} ${g.size} fondo ${g.color}`)
    + report("menú, contraste", f.text, (g) => `${g.where} ${g.size} ${g.color} = ${g.ratio}:1 "${g.text}"`);
  await page.keyboard.press("Escape").catch(() => {});
  return n;
}

const shots = process.env.SHOTS;
if (shots) await mkdir(shots, { recursive: true });
const badge = await readFile("dist/badge.js", "utf8");
const interceptor = await readFile("dist/interceptor.js", "utf8");
const styles = (await Promise.all(CSS.map((f) => readFile(f, "utf8")))).join("\n");
const initial = { theme: "dark", ...(process.env.SKIN === "off" ? { skin: false } : {}) };

const browser = await chromium.launch({ channel: process.env.CHROME_PATH ? undefined : "chrome", executablePath: process.env.CHROME_PATH || undefined, headless: false });
let failed = false;
try {
  for (const [i, pg] of PAGES.entries()) {
    console.log(`${pg.name}: ${pg.url}`);
    const context = await browser.newContext({ viewport: VIEW, locale: "es-AR" });
    await context.route(DEV + "/**", serve);
    await context.exposeBinding("__gondolaCompare", (_src, eans) => compareService.compare(eans).catch(() => ({})));
    await context.exposeBinding("__gondolaNutrition", (_src, ean) => nutritionService.get(ean).catch(() => "error"));
    await context.addInitScript({ content: interceptor });
    await context.addInitScript({ content: injection(badge, styles, initial) });
    const page = await context.newPage();
    try {
      const n = await checkPage(page, pg, i === 0);
      if (n) failed = true;
      console.log(n ? `  ${n} hallazgo(s)` : "  sin hallazgos");
    } catch (e) {
      failed = true;
      console.log(`  no se pudo revisar: ${e.message.split("\n")[0]}`);
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}
process.exit(failed ? 1 : 0);
