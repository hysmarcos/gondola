// Mide la piel Góndola en coto.com.ar. Tarjeta: en cada fila de la grilla, el nombre, el
// precio y el botón quedan a la misma altura, ninguna tarjeta queda más alta que otra y
// "Precio sin impuestos nacionales" no se corta. Página: columnas de la grilla, ancho de la
// columna de filtros, que quede fija al bajar y que no haya barra horizontal.
// Uso: npm run build && npm run skin:check
//   Coto bloquea el Chrome sin ventana, así que abre Chrome visible: no tocar la ventana
//   mientras corre. CHROME_PATH=ruta a Chrome si Playwright no encuentra el instalado.
//   SHOTS=<carpeta>: guarda una captura de la lista, arriba de todo, por tamaño.
//   ONLY=1280x900: mide un solo tamaño.
//   URL=<dirección de coto.com.ar>: mide esa página en lugar de las dos de siempre.
//   INTERACT=1: además, en Leches a 1280 x 900, aplica un filtro, cambia el orden y pasa de
//   página, para ver que la piel no le quitó nada a Coto.
// Sin la extensión cargada y sin sesión: inyecta dist/ (con un chrome.* de mentira, como
// scripts/capture-readme.mjs) y los CSS de la piel, y pone data-gondola-skin="list" a mano.
import { readFile, mkdir } from "node:fs/promises";
import { chromium } from "playwright";
import { createCompareService } from "../src/compare-service.js";

const BASE = "https://www.coto.com.ar";
const PAGES = process.env.URL ? [{ name: process.env.URL, url: process.env.URL }] : [
  { name: "Leches", url: `${BASE}/productos/categorias/catalogo-frescos-l%C3%A1cteos/leches/catv00003266` },
  // Búsqueda mixta: trae productos sin precio por unidad (tarjetas sin etiqueta de Góndola).
  { name: "Búsqueda \"pack\"", url: `${BASE}/productos/busqueda?search=pack` },
];
// columns: tarjetas por fila: 4 desde 1100 px de ancho, 3 por debajo (spec 4.1) y 2 por
// debajo de 992 px, donde 3 no entran (ver el comentario de la grilla en skin-list.css).
const SIZES = [
  { name: "1280x900", viewport: { width: 1280, height: 900 }, scale: 1, columns: 4 },
  { name: "1000x800", viewport: { width: 1000, height: 800 }, scale: 1, columns: 3 },
  { name: "1920x1080", viewport: { width: 1920, height: 1080 }, scale: 1, columns: 4 },
  // Zoom del navegador al 150 %: la ventana de 1280 × 900 deja 853 × 600 px de CSS.
  { name: "1280x900 zoom 1,5", viewport: { width: 853, height: 600 }, scale: 1.5, columns: 2 },
].filter((s) => !process.env.ONLY || s.name === process.env.ONLY);
const CSS = ["src/badge.css", "src/skin.css", "src/skin-list.css"];
const DEV = "https://gondola.local"; // host falso: sirve assets/ (logos de bancos)
const TOLERANCE = 1;
const FILTER_WIDTH = 184; // ancho de la columna de filtros (spec 4.1), más o menos 2 px
const SCROLL_DOWN = 1500;

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
  const cutTall = (el) => (el ? el.scrollHeight > el.clientHeight + 0.5 : false);
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
    const tax = card.querySelector(".centro-precios small.text-center:last-child");
    cards.push({
      name: card.querySelector(".nombre-producto")?.textContent.trim().slice(0, 40),
      labelled,
      cell: top(cell),
      top: { nombre: top(card.querySelector(".nombre-producto")), precio: top(price), botón: top(button) },
      alto: Math.round(card.getBoundingClientRect().height * 10) / 10,
      cortado: [cut(price) && "precio", cut(action) && "botón", (cut(tax) || cutTall(tax)) && "sin impuestos"].filter(Boolean),
    });
  }
  return cards;
}

// Medidas de la página: columnas de la grilla, columna de filtros y barra horizontal.
function measurePage() {
  const filters = document.querySelector("#filtrosmenu");
  const header = document.querySelector("header.section-header, app-header header");
  const rect = filters?.getBoundingClientRect();
  const cells = [...document.querySelectorAll(".productos > .producto-card")].filter((c) => c.getClientRects().length > 0);
  const firstTop = cells[0]?.getBoundingClientRect().top;
  // Cuántas celdas comparten el borde de arriba con la primera: las de la primera fila.
  const columns = cells.filter((c) => Math.abs(c.getBoundingClientRect().top - firstTop) <= 2).length;
  // Nodos de la lista más anchos que la ventana (barra horizontal).
  const wide = [...document.querySelectorAll("section.section-content, section.section-content *")]
    .filter((el) => el.getClientRects().length > 0 && el.scrollWidth > innerWidth)
    .slice(0, 5)
    .map((el) => `${el.tagName.toLowerCase()}.${[...el.classList].slice(0, 2).join(".")} (${el.scrollWidth})`);
  return {
    columns,
    filterWidth: rect ? Math.round(rect.width * 10) / 10 : null,
    headerBottom: header ? Math.round(header.getBoundingClientRect().bottom) : 0,
    docWidth: document.documentElement.scrollWidth,
    innerWidth,
    wide,
  };
}

// Baja SCROLL_DOWN px (o hasta donde la lista todavía sostiene a la columna: al final de una
// lista corta la columna se va con ella, como cualquier sticky) y mide dónde queda la
// columna de filtros; vuelve arriba.
async function measureSticky(page) {
  const y = await page.evaluate((max) => {
    const row = document.querySelector("#filtrosmenu").parentElement.getBoundingClientRect();
    const col = document.querySelector("#filtrosmenu").getBoundingClientRect();
    const header = document.querySelector("header.section-header, app-header header")?.getBoundingClientRect().bottom ?? 0;
    const room = row.bottom + scrollY - Math.min(col.height, innerHeight - header - 12) - header - 12;
    return Math.max(0, Math.min(max, Math.floor(room)));
  }, SCROLL_DOWN);
  await page.evaluate((to) => scrollTo(0, to), y);
  await page.waitForTimeout(500);
  const r = await page.evaluate(() => {
    const f = document.querySelector("#filtrosmenu").getBoundingClientRect();
    return { scrollY: Math.round(scrollY), top: Math.round(f.top), bottom: Math.round(f.bottom), innerHeight };
  });
  await page.evaluate(() => scrollTo(0, 0));
  await page.waitForTimeout(300);
  return r;
}

// Problemas de la página, en texto. Vacío si todo está como pide el spec.
function checkPage(p, sticky, size) {
  const problems = [];
  if (p.columns !== size.columns) problems.push(`grilla: ${p.columns} tarjetas en la primera fila, se esperaban ${size.columns}`);
  if (p.filterWidth === null || Math.abs(p.filterWidth - FILTER_WIDTH) > 2) problems.push(`filtros: la columna mide ${p.filterWidth} px, se esperaban ${FILTER_WIDTH} (más o menos 2)`);
  if (sticky.scrollY < 400) problems.push(`filtros: la página solo bajó ${sticky.scrollY} px, no alcanza para medir si quedan fijos`);
  else if (sticky.top < p.headerBottom - 1 || sticky.top >= sticky.innerHeight) problems.push(`filtros: tras bajar ${sticky.scrollY} px la columna queda con top ${sticky.top} (el encabezado de Coto llega a ${p.headerBottom}, la ventana a ${sticky.innerHeight})`);
  if (p.docWidth > p.innerWidth) problems.push(`barra horizontal: la página mide ${p.docWidth} px y la ventana ${p.innerWidth}`);
  if (p.wide.length) problems.push(`barra horizontal: nodos más anchos que la ventana: ${p.wide.join(", ")}`);
  return problems;
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

// Con la piel puesta, los controles de Coto siguen respondiendo: aplica un filtro y lo saca,
// cambia el orden (menor precio y el de Góndola) y pasa de página. Devuelve problemas y notas.
async function interact(page) {
  const problems = [];
  const notes = [];
  const state = () => page.evaluate(() => ({
    url: location.href,
    count: document.querySelector(".plp-header__count")?.textContent.trim(),
    ids: [...document.querySelectorAll(".productos .card-container")].slice(0, 8).map((c) => c.dataset.cnstrcItemId).join(","),
    prices: [...document.querySelectorAll(".productos .card-container")].slice(0, 8).map((c) => Number(c.dataset.cnstrcItemPrice)),
  }));
  const settle = async (before, what) => {
    for (let i = 0; i < 30; i++) {
      await page.waitForTimeout(500);
      const now = await state();
      if (now.url !== before.url || now.count !== before.count || now.ids !== before.ids) {
        await page.waitForTimeout(1500);
        return state();
      }
    }
    problems.push(`${what}: la página no respondió en 15 s`);
    return before;
  };
  let before = await state();

  const brand = page.locator("#filtrosmenu .filter-block", { has: page.locator(".filter-title", { hasText: /^\s*Marca\s*$/ }) });
  const link = brand.locator(".filter-list > li > a:not(.active)").first();
  const name = (await link.innerText()).replace(/\s+/g, " ").trim();
  await link.click();
  let now = await settle(before, "filtro");
  notes.push(`filtro "${name}": ${before.count} -> ${now.count}; la dirección ${now.url === before.url ? "no cambió" : "cambió"}`);
  const chip = page.locator("#filtrosmenu app-breadcrumbs ul + ul a").first();
  if (!(await chip.count())) problems.push("filtro: no apareció el chip del filtro puesto");
  else {
    before = now;
    await chip.click();
    now = await settle(before, "sacar el filtro");
    notes.push(`sacar el filtro con su chip: ${before.count} -> ${now.count}`);
  }

  const sortPrice = async (label, what) => {
    before = now;
    const option = page.locator("#plpSort option", { hasText: label }).first();
    if (!(await option.count())) return problems.push(`${what}: no está la opción "${label}"`);
    await page.selectOption("#plpSort", { value: await option.getAttribute("value") });
    now = await settle(before, what);
    return now;
  };
  await sortPrice(/menor a mayor/, "orden por precio");
  // data-cnstrc-item-price es el precio de lista: con ofertas no sube parejo, así que solo se
  // pide que el orden haya cambiado.
  notes.push(`orden "Precio: de menor a mayor": ${now.ids === before.ids ? "sin cambios" : "reordenó"} (primeros precios de lista ${now.prices.slice(0, 5).join(", ")})`);
  if (now.ids === before.ids) problems.push("orden por precio: los productos no se reordenaron");
  await sortPrice(/kg|litro/i, "orden por precio por kg/L");
  notes.push(`orden "precio por kg/L": ${now.ids === before.ids ? "sin cambios" : "reordenó"}`);
  if (now.ids === before.ids) problems.push("orden por precio por kg/L: los productos no se reordenaron");
  // El aviso de Góndola (solo sale si el orden se pasa de 1.000 productos o falla): se pide
  // con el mismo mensaje que manda el interceptor y debe quedar debajo del encabezado.
  await page.evaluate(() => postMessage({ source: "coto-unit", type: "notice", text: "Se ordenaron los primeros 1.000 productos", seq: 1e9 }, "*"));
  await page.waitForTimeout(500);
  const box = await page.evaluate(() => {
    const n = document.querySelector(".coto-unit-notice")?.getBoundingClientRect();
    const h = document.querySelector(".plp-header").getBoundingClientRect();
    const sort = document.querySelector(".plp-header__sort").getBoundingClientRect();
    return n ? { top: n.top, bottom: n.bottom, left: n.left, right: n.right, headerLeft: h.left, headerRight: h.right, sortBottom: sort.bottom } : null;
  });
  if (!box) problems.push("aviso: no apareció");
  else if (box.top < box.sortBottom - 1 || box.left < box.headerLeft - 1 || box.right > box.headerRight + 1) problems.push(`aviso: queda fuera de su lugar (top ${box.top}, orden termina en ${box.sortBottom})`);
  else notes.push(`aviso de Góndola: debajo del orden (top ${Math.round(box.top)} px, orden termina en ${Math.round(box.sortBottom)} px) y dentro del encabezado`);
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/aviso.png`, clip: { x: 0, y: Math.max(0, box ? box.top - 150 : 0), width: 1280, height: 300 } });

  before = now;
  const next = page.locator("app-paginator .pages-link").first();
  if (!(await next.count())) problems.push("paginación: no hay link a la página 2");
  else {
    await next.click();
    now = await settle(before, "paginación");
    notes.push(`página 2: ${now.ids === before.ids ? "mismos productos" : "otros productos"}`);
  }
  return { problems, notes };
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
        // Sin tarjetas o con una sola fila no hay nada que comparar: no es un "pasa".
        if (all.flat().length === 0) problems.push("no se midió ninguna tarjeta");
        else if (all.length < 2) problems.push(`solo hay ${all.length} fila: no alcanza para comparar filas`);
        const pageMeasures = await page.evaluate(measurePage);
        const sticky = await measureSticky(page);
        problems.push(...checkPage(pageMeasures, sticky, size));
        const extra = unlabelled ? ` (${unlabelled} sin etiqueta)` : " (ninguna tarjeta sin etiqueta)";
        if (problems.length) {
          failed = true;
          console.log(`${size.name}: ${all.length} filas${extra}:\n  ${problems.join("\n  ")}`);
        } else {
          console.log(`${size.name}: ${all.length} filas, alineadas${extra}; ${pageMeasures.columns} por fila, filtros de ${pageMeasures.filterWidth} px, fijos (top ${sticky.top} tras bajar ${sticky.scrollY} px), sin barra horizontal`);
        }
        if (shots) {
          // La página arriba de todo: encabezado, filtros y primera fila.
          await page.evaluate(() => scrollTo(0, 0));
          await page.waitForTimeout(400);
          await page.screenshot({ path: `${shots}/${PAGES.indexOf(pg) + 1}-${size.name.replace(/[ ,]+/g, "-")}.png` });
        }
        if (process.env.INTERACT && pg.name === "Leches" && size.name === "1280x900") {
          // Después de las mediciones: la página cambia con cada clic.
          const r = await interact(page);
          for (const n of r.notes) console.log(`  interacción: ${n}`);
          if (r.problems.length) {
            failed = true;
            console.log(`  interacción:\n    ${r.problems.join("\n    ")}`);
          }
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
