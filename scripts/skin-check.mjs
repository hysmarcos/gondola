// Mide la piel Góndola en coto.com.ar. Tarjeta: en cada fila de la grilla, el nombre, el
// precio y el botón quedan a la misma altura, ninguna tarjeta queda más alta que otra y
// "Precio sin impuestos nacionales" no se corta. Página: columnas de la grilla, ancho de la
// columna de filtros, que quede fija al bajar y que no haya barra horizontal.
// Uso: npm run build && npm run skin:check
//   Coto bloquea el Chrome sin ventana, así que abre Chrome visible: no tocar la ventana
//   mientras corre. CHROME_PATH=ruta a Chrome si Playwright no encuentra el instalado.
//   SHOTS=<carpeta>: guarda una captura de la lista, arriba de todo, por tamaño.
//   ONLY=1280x900: mide un solo tamaño.
//   PROFILE=<JSON>: pone esas claves de perfil en el storage de mentira (por ejemplo
//   {"profileAllergens":["milk"]}) y cuenta las etiquetas "para vos" de la lista. Falla si
//   alguna está cortada; dice cuántas tarjetas las tienen en dos filas y si tapan las de arriba.
//   URL=<dirección de coto.com.ar>: mide esa página en lugar de las dos de siempre.
//   INTERACT=1: además, en Leches a 1280 x 900, aplica un filtro, cambia el orden y pasa de
//   página, para ver que la piel no le quitó nada a Coto.
// Página de producto (PLU 508911, 1280 × 900): la caja de compra mide 380 px, sigue en la
// ventana al bajar 600 px, nunca pasa por encima del pie y no hay barra horizontal.
//   ONLY_PDP=1: mide solo la página de producto. PDP_URL=<dirección>: otra página de producto.
//   Etiqueta de nutrición: la columna mide 300 px; "Por porción" oculta la columna de cada
//   100 y cambia el primer número grande; con "cada 100" no se ven %VD ni su nota (son de
//   la porción) y con "Por porción" sí; sin barra horizontal.
//   Con SHOTS, guarda pdp-top.png (arriba de todo), pdp-600.png (600 px más abajo) y
//   pdp-detalle.png (nutrición, descripción y características).
//   Con INTERACT=1, además hace click en "Agregar" y en "Ver planes de cuotas" y cuenta qué
//   hizo Coto (sin sesión, "Agregar" abre su aviso para ingresar).
// Sin la extensión cargada y sin sesión: inyecta dist/ (con un chrome.* de mentira, como
// scripts/capture-readme.mjs) y los CSS de la piel, y pone data-gondola-skin ("list" o "pdp")
// a mano. Lo que hace el service worker (otros súper e información nutricional de Open Food
// Facts) corre acá, en Node; a Open Food Facts solo viaja el código de barras.
import { readFile, mkdir } from "node:fs/promises";
import { chromium } from "playwright";
import { services, connect, injection } from "./lib/fake-extension.mjs";

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
// Los CSS del content script de Coto, leídos de manifest.json en su orden: los tokens --g-*
// viven en src/theme.css.
const manifest = JSON.parse(await readFile("manifest.json", "utf8"));
const CSS = manifest.content_scripts.find((c) => c.css).css;
const PDP = { name: "PDP Leche Protein (PLU 508911)", url: process.env.PDP_URL || `${BASE}/productos/leche-protein-la-serenisima-1l/_/R-00508911-00508911-200` };
const PDP_SIZE = { name: "1280x900", viewport: { width: 1280, height: 900 }, scale: 1 };
const BUY_WIDTH = 380; // caja de compra (spec 5.1), más o menos 2 px
const PDP_SCROLL = 600;
const LABEL_WIDTH = 300; // columna de la etiqueta de nutrición (spec 5.3), más o menos 2 px
const TOLERANCE = 1;
const FILTER_WIDTH = 184; // ancho de la columna de filtros (spec 4.1), más o menos 2 px
const SCROLL_DOWN = 1500;

// Lo que en la extensión hace el service worker: otros súper e información nutricional (la
// PDP de un alimento la muestra, y con ella la columna izquierda es más alta).
const svc = services();

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

// ---------- Página de producto ----------

// Caja de compra, encabezado y pie, en coordenadas de la ventana.
function measurePdp() {
  const buy = document.querySelector("app-product-detail aside.row > div");
  const header = document.querySelector("header.section-header, app-header header");
  const footer = document.querySelector("footer");
  const r = buy?.getBoundingClientRect();
  // Primer ascendiente que corta el sticky (overflow que no sea visible ni clip).
  let scroller = null;
  for (let e = buy?.parentElement; e && e !== document.documentElement && !scroller; e = e.parentElement) {
    const o = getComputedStyle(e);
    if (![o.overflowX, o.overflowY].every((v) => v === "visible" || v === "clip")) scroller = `${e.tagName.toLowerCase()}.${[...e.classList].slice(0, 2).join(".")} (overflow ${o.overflowX} ${o.overflowY})`;
  }
  return {
    found: !!buy,
    position: buy ? getComputedStyle(buy).position : null,
    scroller,
    width: r ? Math.round(r.width * 10) / 10 : null,
    top: r ? Math.round(r.top) : null,
    bottom: r ? Math.round(r.bottom) : null,
    headerBottom: header ? Math.round(header.getBoundingClientRect().bottom) : 0,
    footerTop: footer ? Math.round(footer.getBoundingClientRect().top) : null,
    scrollY: Math.round(scrollY),
    maxScroll: document.documentElement.scrollHeight - innerHeight,
    docWidth: document.documentElement.scrollWidth,
    innerWidth,
    innerHeight,
  };
}

async function scrollAndMeasure(page, y) {
  await page.evaluate((to) => scrollTo(0, to), y);
  await page.waitForTimeout(350);
  return page.evaluate(measurePdp);
}

// Problemas de la caja de compra, en texto. Vacío si todo está como pide el spec.
async function checkPdp(page) {
  const problems = [];
  const notes = [];
  const top = await scrollAndMeasure(page, 0);
  if (!top.found) return { problems: ["caja de compra: no está app-product-detail aside.row > div"], notes };
  if (Math.abs(top.width - BUY_WIDTH) > 2) problems.push(`caja de compra: mide ${top.width} px, se esperaban ${BUY_WIDTH} (más o menos 2)`);
  if (top.docWidth > top.innerWidth) problems.push(`barra horizontal: la página mide ${top.docWidth} px y la ventana ${top.innerWidth}`);
  const down = await scrollAndMeasure(page, PDP_SCROLL);
  if (down.scrollY < PDP_SCROLL) problems.push(`la página solo bajó ${down.scrollY} px, no alcanza para medir si la caja queda fija`);
  else if (down.top < down.headerBottom - 1 || down.top >= down.innerHeight) problems.push(`caja de compra: tras bajar ${down.scrollY} px queda con top ${down.top} (el encabezado de Coto llega a ${down.headerBottom}, la ventana a ${down.innerHeight}; position ${down.position}${down.scroller ? `, lo corta ${down.scroller}` : ""})`);
  else notes.push(`tras bajar ${down.scrollY} px: top ${down.top} (antes ${top.top}), encabezado hasta ${down.headerBottom}`);
  // Hasta el final, de a 200 px: la caja nunca pasa por encima del pie.
  let worst = null;
  for (let y = 0; y <= top.maxScroll + 200; y += 200) {
    const m = await scrollAndMeasure(page, Math.min(y, top.maxScroll));
    if (m.footerTop !== null && m.bottom > m.footerTop + 1 && (!worst || m.bottom - m.footerTop > worst.over)) worst = { over: m.bottom - m.footerTop, scrollY: m.scrollY };
    if (y >= top.maxScroll) break;
  }
  if (top.footerTop === null) problems.push("pie: no está <footer>");
  else if (worst) problems.push(`caja de compra: tapa el pie ${worst.over} px tras bajar ${worst.scrollY} px`);
  await page.evaluate(() => scrollTo(0, 0));
  await page.waitForTimeout(300);
  return { problems, notes };
}

// Etiqueta de nutrición (spec 5.3): columna de 300 px; "Por porción" oculta la columna de
// "cada 100" y cambia los números grandes; sin barra horizontal. Vacío si no hay tabla.
async function checkNutrition(page) {
  const problems = [];
  const notes = [];
  const state = () => page.evaluate(() => {
    const sec = document.querySelector(".coto-unit-nutri-section[data-skin][data-basis]");
    if (!sec) return null;
    const width = (el) => (el ? Math.round(el.getBoundingClientRect().width * 10) / 10 : null);
    const shown = (el) => !!el && el.getClientRects().length > 0;
    return {
      title: width(sec.querySelector(".coto-unit-nutri-title")),
      table: width(sec.querySelector(".coto-unit-nutri-table")),
      per100: shown(sec.querySelector(".coto-unit-nutri-table thead th:nth-child(2)")),
      // %VD: es de la porción; con "cada 100" no se muestra ni la columna ni la nota.
      vd: [...sec.querySelectorAll(".coto-unit-nutri-table :is(th, td):nth-child(4)")].some(shown),
      note: shown(sec.querySelector(".coto-unit-nutri-note")),
      hasSeg: !!sec.querySelector(".coto-unit-nutri-seg"),
      tile: sec.querySelector(".coto-unit-nutri-tiles > *")?.textContent ?? null,
      basis: sec.dataset.basis,
      docWidth: document.documentElement.scrollWidth,
      innerWidth,
    };
  });
  const before = await state();
  if (!before) return { problems, notes: ["sin tabla de nutrición con la piel: no se midió la etiqueta"] };
  for (const [name, w] of [["título", before.title], ["tabla", before.table]]) {
    if (w === null || Math.abs(w - LABEL_WIDTH) > 2) problems.push(`etiqueta de nutrición (${name}): mide ${w} px, se esperaban ${LABEL_WIDTH} (más o menos 2)`);
  }
  if (!before.per100) problems.push("etiqueta de nutrición: con \"cada 100\" no se ve esa columna");
  if (before.vd) problems.push("etiqueta de nutrición: con \"cada 100\" se ve la columna %VD (es de la porción)");
  if (before.note) problems.push("etiqueta de nutrición: con \"cada 100\" se ve la nota de %VD");
  if (!before.hasSeg) problems.push("etiqueta de nutrición: no está el interruptor \"Por porción\"");
  else {
    await page.locator(".coto-unit-nutri-seg button").nth(1).click();
    await page.waitForTimeout(200);
    const after = await state();
    if (after.basis !== "portion") problems.push(`etiqueta de nutrición: tras "Por porción", data-basis es ${after.basis}`);
    if (after.per100) problems.push("etiqueta de nutrición: tras \"Por porción\" se sigue viendo la columna de cada 100");
    if (!after.vd) problems.push("etiqueta de nutrición: tras \"Por porción\" no se ve la columna %VD");
    if (!after.note) problems.push("etiqueta de nutrición: tras \"Por porción\" no se ve la nota de %VD");
    if (after.table !== before.table) problems.push(`etiqueta de nutrición: el ancho cambia de ${before.table} a ${after.table} px con "Por porción"`);
    if (shots) await shootDetail(page, `${shots}/pdp-detalle-porcion.png`);
    if (after.tile === before.tile) problems.push(`etiqueta de nutrición: tras "Por porción" el primer número grande sigue igual (${after.tile})`);
    else notes.push(`primer número grande: "${before.tile}" → "${after.tile}"`);
    if (after.docWidth > after.innerWidth) problems.push(`barra horizontal tras "Por porción": la página mide ${after.docWidth} px y la ventana ${after.innerWidth}`);
    await page.locator(".coto-unit-nutri-seg button").nth(0).click();
  }
  if (before.docWidth > before.innerWidth) problems.push(`barra horizontal con la etiqueta: la página mide ${before.docWidth} px y la ventana ${before.innerWidth}`);
  return { problems, notes };
}

// Captura de la columna izquierda: de la nutrición (o la descripción) al final de las
// características, para mirar la etiqueta y la ficha.
async function shootDetail(page, path) {
  const box = await page.evaluate(() => {
    const first = document.querySelector(".coto-unit-nutri-section") ?? document.querySelector(".pdp-description");
    const host = first?.parentElement;
    if (!host) return null;
    const r = host.getBoundingClientRect();
    return { y: r.top + scrollY, height: r.height };
  });
  if (!box) return;
  await page.screenshot({ path, fullPage: true, clip: { x: 0, y: Math.max(0, box.y - 24), width: PDP_SIZE.viewport.width, height: box.height + 48 } });
}

// Con la piel puesta, los controles de Coto de la caja de compra siguen respondiendo.
async function interactPdp(page) {
  const notes = [];
  const dialogs = [];
  const onDialog = (d) => {
    dialogs.push(`${d.type()}: "${d.message().replace(/\s+/g, " ").trim()}"`);
    d.dismiss().catch(() => {});
  };
  page.on("dialog", onDialog);
  const visibleModals = () => page.evaluate(() => [...document.querySelectorAll(".modal, [role=dialog], .swal2-popup, .cdk-overlay-pane")]
    .filter((m) => m.getClientRects().length > 0 && getComputedStyle(m).visibility !== "hidden" && getComputedStyle(m).display !== "none")
    .map((m) => `${m.tagName.toLowerCase()}.${[...m.classList].slice(0, 3).join(".")}: ${m.textContent.replace(/\s+/g, " ").trim().slice(0, 120)}`));
  const closeAll = async () => {
    await page.keyboard.press("Escape").catch(() => {});
    await page.waitForTimeout(400);
    for (const sel of [".modal.show .btn-close", ".modal.show [data-bs-dismiss=modal]", ".modal.show .close", ".swal2-cancel", ".swal2-close"]) {
      const b = page.locator(sel).first();
      if (await b.count() && await b.isVisible().catch(() => false)) await b.click().catch(() => {});
    }
    await page.waitForTimeout(400);
  };

  const before = await visibleModals();
  await page.locator("app-product-detail aside.row product-add-show-remove .btn-primary").first().click();
  await page.waitForTimeout(2000);
  const afterAdd = await visibleModals();
  notes.push(`"Agregar": ${dialogs.length ? `diálogo ${dialogs.join(" | ")}` : "sin diálogo nativo"}; ventanas nuevas: ${afterAdd.filter((m) => !before.includes(m)).join(" | ") || "ninguna"}`);
  await closeAll();
  const n = dialogs.length;
  const base = await visibleModals();
  await page.locator("app-product-detail aside.row a:has(> .form-check-label)").first().click();
  await page.waitForTimeout(2000);
  const afterCuotas = await visibleModals();
  notes.push(`"Ver planes de cuotas": ${dialogs.length > n ? `diálogo ${dialogs.slice(n).join(" | ")}` : "sin diálogo nativo"}; ventanas nuevas: ${afterCuotas.filter((m) => !base.includes(m)).join(" | ") || "ninguna"}`);
  await closeAll();
  page.off("dialog", onDialog);
  return notes;
}

async function newContext(size, kind) {
  const context = await browser.newContext({ viewport: size.viewport, deviceScaleFactor: size.scale, locale: "es-AR" });
  await connect(context, svc);
  await context.addInitScript({ content: interceptor });
  // El ajuste "skin" queda prendido y data-gondola-skin se pone a mano; el storage queda en
  // window.__gondolaStorage para PROFILE.
  await context.addInitScript({ content: injection({ badge, styles, styleId: "gondola-skin-check", exposeStorage: true, before: `document.documentElement.setAttribute("data-gondola-skin", ${JSON.stringify(kind)});` }) });
  if (process.env.PROFILE) await context.addInitScript({ content: `window.__gondolaStorage?.set(${JSON.stringify(JSON.parse(process.env.PROFILE))});` });
  return context;
}

async function runPdp() {
  console.log(PDP.name);
  const context = await newContext(PDP_SIZE, "pdp");
  const page = await context.newPage();
  try {
    await page.goto(PDP.url, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("app-product-detail .price", { timeout: 45000 });
    await page.waitForSelector(".coto-unit-box--pdp", { timeout: 30000 });
    // Que llegue la comparación con otros súper (cambia el alto de la caja).
    await page.waitForFunction(() => !document.querySelector(".coto-unit-box--pdp .coto-unit-cmp-row--pending"), null, { timeout: 20000 }).catch(() => {});
    // Y la información nutricional (un producto que no es comida no la tiene).
    const nutri = await page.waitForSelector(".coto-unit-nutri-section", { timeout: 15000 }).then(() => true, () => false);
    await page.waitForTimeout(1500);
    const { problems, notes } = await checkPdp(page);
    notes.push(nutri ? "con información nutricional" : "sin información nutricional");
    if (problems.length) {
      failed = true;
      console.log(`${PDP_SIZE.name}:\n  ${problems.join("\n  ")}`);
    } else {
      console.log(`${PDP_SIZE.name}: caja de compra de ${BUY_WIDTH} px, fija (${notes.join("; ")}), no tapa el pie, sin barra horizontal`);
    }
    const label = await checkNutrition(page);
    if (label.problems.length) {
      failed = true;
      console.log(`${PDP_SIZE.name} nutrición:\n  ${label.problems.join("\n  ")}`);
    } else if (label.notes[0]?.startsWith("sin tabla")) {
      console.log(`${PDP_SIZE.name} nutrición: ${label.notes[0]}`);
    } else {
      console.log(`${PDP_SIZE.name} nutrición: etiqueta de ${LABEL_WIDTH} px; con "cada 100" sin %VD ni su nota; "Por porción" oculta la columna de cada 100, muestra %VD y su nota, mismo ancho, y cambia los números (${label.notes.join("; ")}); sin barra horizontal`);
    }
    if (shots) {
      await page.evaluate(() => scrollTo(0, 0));
      await page.waitForTimeout(400);
      await page.screenshot({ path: `${shots}/pdp-top.png` });
      await page.evaluate((y) => scrollTo(0, y), PDP_SCROLL);
      await page.waitForTimeout(400);
      await page.screenshot({ path: `${shots}/pdp-600.png` });
      await shootDetail(page, `${shots}/pdp-detalle.png`);
      await page.evaluate(() => scrollTo(0, 0));
    }
    if (process.env.INTERACT) for (const n of await interactPdp(page)) console.log(`  interacción: ${n}`);
  } catch (e) {
    failed = true;
    console.log(`${PDP_SIZE.name}: no se pudo medir: ${e.message.split("\n")[0]}`);
  } finally {
    await context.close();
  }
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
  for (const pg of process.env.ONLY_PDP ? [] : PAGES) {
    console.log(pg.name);
    for (const size of SIZES) {
      const context = await newContext(size, "list");
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
        if (process.env.PROFILE) console.log(`  etiquetas para vos: ${await page.evaluate(() => document.querySelectorAll(".coto-unit-foryou > span").length)} en ${await page.evaluate(() => document.querySelectorAll(".coto-unit-foryou").length)} tarjetas`);
        // Etiquetas "para vos": ninguna se corta (si no entran, bajan a otra fila). Y si la caja
        // de dos filas llega a tapar las etiquetas de arriba (más barato, oferta), se avisa con
        // las medidas.
        const tagProblems = [];
        if (process.env.PROFILE) {
          const t = await page.evaluate(() => {
            const cut = [];
            const overlap = [];
            for (const box of document.querySelectorAll(".coto-unit-foryou")) {
              for (const s of box.children) if (s.scrollWidth > s.clientWidth + 0.5) cut.push(`"${s.textContent}" (${s.scrollWidth} > ${s.clientWidth} px)`);
              const top = box.closest(".top-imagen-promos")?.querySelector(".coto-unit-tags");
              if (!top || !top.getClientRects().length) continue;
              const a = box.getBoundingClientRect();
              const b = top.getBoundingClientRect();
              if (a.top < b.bottom) overlap.push(`para vos desde ${Math.round(a.top - b.top)} px, etiquetas de arriba hasta ${Math.round(b.height)} px (foto de ${Math.round(box.parentElement.getBoundingClientRect().height)} px)`);
            }
            return { cut, overlap, rows2: [...document.querySelectorAll(".coto-unit-foryou")].filter((b) => b.children.length > 1 && b.children[0].getBoundingClientRect().top !== b.children[1].getBoundingClientRect().top).length };
          });
          for (const c of t.cut) tagProblems.push(`etiqueta para vos cortada: ${c}`);
          console.log(`  en dos filas: ${t.rows2} tarjetas; tapan las etiquetas de arriba: ${t.overlap.length ? t.overlap.join("; ") : "ninguna"}`);
        }
        const all = rows(await page.evaluate(measure));
        const unlabelled = all.flat().filter((c) => !c.labelled).length;
        unlabelledSeen += unlabelled;
        const problems = [...all.flatMap(check), ...tagProblems];
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
  if (!process.env.URL && (!process.env.ONLY || process.env.ONLY === PDP_SIZE.name)) await runPdp();
} finally {
  await browser.close();
}
if (!unlabelledSeen && !process.env.ONLY_PDP) console.log("Aviso: ninguna página trajo una tarjeta sin etiqueta de Góndola; el punto 2 de Review Focus no quedó medido.");
process.exit(failed ? 1 : 0);
