// Guarda el HTML real de la lista de productos y de la página de producto de Coto en
// tests/fixtures/dom/. De ahí sale el mapa de selectores de src/skin-dom.js.
// Sin la extensión cargada y sin sesión: no se guardan cookies ni datos de la persona.
// Uso: npm run fixtures:dom
//   Coto bloquea el Chrome sin ventana ("no pudimos completar tu solicitud"), así que abre
//   Chrome visible: no tocar la ventana mientras corre. CHROME_PATH=ruta a Chrome si
//   Playwright no encuentra el instalado.
//   WAIT_STEPPER=<segundos>: el selector de cantidad solo aparece con sesión iniciada (sin
//   sesión, "Agregar" pide iniciarla). Con esta variable el script espera ese tiempo a que
//   inicies sesión en la ventana y agregues un producto; no escribe ninguna clave por vos.
//   El encabezado, donde Coto muestra la dirección y el nombre, nunca se guarda.
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";

const BASE = "https://www.coto.com.ar";
// Leches filtrada por marca: así la captura trae filtros aplicados y subcategorías.
const LIST_URL = process.env.LIST_URL ?? `${BASE}/productos/categorias/catalogo-frescos-l%C3%A1cteos/leches/catv00003266?filters%5Bproduct_brand%5D=LA%20SERENISIMA`;
// Leche Protein La Serenísima 1 L (PLU 508911). Si ya no existe, se usa el primer producto de la lista.
const PDP_URL = process.env.PDP_URL ?? `${BASE}/productos/leche-protein-la-serenisima-1l-/_/R-00508911-00508911-200`;
const OUT = "tests/fixtures/dom";
const MAX_CARDS = 8;
const STEPPER = 'product-add-show-remove input[id^="input-prod"]';
const VIEW = { width: 1280, height: 860 };

// Partes de la página que no hacen falta para los selectores o que pueden traer datos de la persona.
const DROP = "script, style, noscript, iframe, link, template, app-header, footer-section, app-chat-agent, ngx-spinner, .grecaptcha-badge, #a11y-status-message";

async function open(page, url, ready) {
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(ready, { timeout: 45000 });
  await page.waitForTimeout(3000);
}

// Devuelve body.outerHTML limpio. keep: función que, en la lista, elige las tarjetas a conservar.
function snapshot(page, { cards }) {
  return page.evaluate(({ drop, cards, max, stepper }) => {
    const body = document.body.cloneNode(true);
    body.querySelectorAll(drop).forEach((n) => n.remove());
    for (const img of body.querySelectorAll("img, source")) {
      for (const a of ["src", "srcset", "data-src", "data-srcset"]) img.removeAttribute(a);
    }
    const walker = document.createTreeWalker(body, NodeFilter.SHOW_COMMENT);
    const comments = [];
    while (walker.nextNode()) comments.push(walker.currentNode);
    comments.forEach((c) => c.remove());
    if (cards) {
      const all = [...body.querySelectorAll(".producto-card")];
      // Las tarjetas con selector de cantidad siempre se quedan; el resto, hasta completar.
      const withStepper = all.filter((c) => c.querySelector(stepper));
      const keep = new Set([...withStepper, ...all.filter((c) => !withStepper.includes(c))].slice(0, Math.max(max, withStepper.length)));
      all.forEach((c) => { if (!keep.has(c)) c.remove(); });
    }
    return body.outerHTML;
  }, { drop: DROP, cards, max: MAX_CARDS, stepper: STEPPER });
}

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ channel: process.env.CHROME_PATH ? undefined : "chrome", executablePath: process.env.CHROME_PATH || undefined, headless: false });
const context = await browser.newContext({ viewport: VIEW, locale: "es-AR" });
const page = await context.newPage();

// Lista
await open(page, LIST_URL, ".card-container");
const wait = Number(process.env.WAIT_STEPPER ?? 0);
if (wait) {
  console.log(`Esperando hasta ${wait} s a que haya un selector de cantidad: iniciá sesión y agregá un producto en la ventana.`);
  const until = Date.now() + wait * 1000;
  while (Date.now() < until && !(await page.locator(STEPPER).count())) {
    if (!page.url().includes("catv00003266")) await open(page, LIST_URL, ".card-container").catch(() => {});
    await page.waitForTimeout(2000);
  }
}
const listHtml = await snapshot(page, { cards: true });
const kept = (listHtml.match(/class="[^"]*\bproducto-card\b/g) ?? []).length;
const stepperSeen = await page.locator(STEPPER).count();
const firstProduct = await page.locator('a[href*="_/R-"]').first().getAttribute("href");
await writeFile(`${OUT}/lista.html`, listHtml);

// Producto
let pdpUrl = PDP_URL;
const res = await page.goto(pdpUrl, { waitUntil: "domcontentloaded" });
const ok = await page.waitForSelector(".price", { timeout: 30000 }).then(() => true, () => false);
if (!ok || (res && res.status() >= 400)) {
  pdpUrl = BASE + firstProduct;
  console.log(`La página de ejemplo no cargó; uso el primer producto de la lista: ${pdpUrl}`);
  await open(page, pdpUrl, ".price");
}
await page.waitForSelector("product-add-show-remove", { timeout: 15000 });
await page.waitForTimeout(3000);
const pdpHtml = await snapshot(page, { cards: false });
await writeFile(`${OUT}/pdp.html`, pdpHtml);
await browser.close();

const kb = (s) => (Buffer.byteLength(s) / 1024).toFixed(1) + " KB";
console.log(JSON.stringify({ tarjetas: kept, conSelectorDeCantidad: stepperSeen, lista: kb(listHtml), pdp: kb(pdpHtml), pdpUrl }));
