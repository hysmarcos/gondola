// Capturas del README: la misma página de Coto sin Góndola (antes) y con Góndola (después).
// Necesita la demo armada (Chrome visible: no tocar la ventana mientras corre):
//   npx esbuild scripts/readme-demo.js --bundle --format=iife --minify --loader:.css=text --outfile=dist-dev/demo.min.js
// Uso: HEADED=1 node scripts/capture-readme.mjs   (CHROME_PATH=ruta a Chrome si Playwright no trae uno)
// Los logos y los precios de otros súper los sirve este script (host falso gondola.local).
import { mkdir, readFile } from "node:fs/promises";
import { chromium } from "playwright";

const DEV = "https://gondola.local";
const STORES = ["www.carrefour.com.ar", "diaonline.supermercadosdia.com.ar", "www.masonline.com.ar"];
const CORS = { "Access-Control-Allow-Origin": "*" };

// Lo que en la extensión hace el service worker: pedir precios a otros súper. Solo esos hosts.
async function serve(route) {
  const req = route.request();
  const url = new URL(req.url());
  if (url.pathname === "/proxy") {
    const target = new URL(url.searchParams.get("url") ?? "");
    if (target.protocol !== "https:" || !STORES.includes(target.hostname)) return route.fulfill({ status: 403, headers: CORS });
    const post = req.method() === "POST";
    const res = await fetch(target, { method: req.method(), headers: post ? { "content-type": "application/json" } : {}, body: post ? req.postData() : undefined }).catch(() => null);
    if (!res) return route.fulfill({ status: 502, headers: CORS });
    return route.fulfill({ status: res.status, headers: { ...CORS, "content-type": "application/json" }, body: await res.text() });
  }
  if (url.pathname.startsWith("/assets/") && !url.pathname.includes("..")) {
    return route.fulfill({ headers: CORS, body: await readFile("." + decodeURIComponent(url.pathname)).catch(() => ""), contentType: url.pathname.endsWith(".png") ? "image/png" : "application/octet-stream" });
  }
  return route.fulfill({ status: 404, headers: CORS });
}

const URL_CAT = process.env.CAT ?? "https://www.coto.com.ar/productos/categorias/catalogo-frescos/pastas-frescas-y-tapas/pastas-rellenas/catv00001869";
const CAT_ID = URL_CAT.match(/catv\d+/)[0];
const OUT = process.env.OUT ?? "docs/img/readme/raw";
const VIDEO = process.env.VIDEO_DIR ?? "dist-dev/video";
const VIEW = { width: 1280, height: 860 };
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined, headless: process.env.HEADED ? false : true });
const demo = await readFile("dist-dev/demo.min.js", "utf8");

async function open({ withGondola, video }) {
  const context = await browser.newContext({ viewport: VIEW, deviceScaleFactor: 2, locale: "es-AR", ...(video ? { recordVideo: { dir: VIDEO, size: VIEW } } : {}) });
  if (withGondola) {
    await context.route(DEV + "/**", serve);
    await context.addInitScript({ content: `window.__cotoSettings = { day: "hoy" }; window.__gondolaDev = "${DEV}";` });
    await context.addInitScript({ content: demo });
  }
  const page = await context.newPage();
  await page.goto(URL_CAT, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("constructor-result-item", { timeout: 45000 });
  await page.waitForTimeout(2500);
  return { context, page };
}

// Elige la promo bancaria de hoy con más descuento, como haría alguien en el popup.
async function pickBank(page) {
  return page.evaluate(async () => {
    const st = window.__cotoStorage;
    const today = new Date().getDay();
    // Las promos llegan de la API de Coto unos segundos después de cargar.
    let all = [];
    for (let i = 0; i < 40 && !all.length; i++) {
      all = (await st.get(["promos"])).promos ?? [];
      if (!all.length) await new Promise((r) => setTimeout(r, 500));
    }
    const promos = all.filter((p) => p.days.includes(today)).sort((a, b) => b.percent - a.percent);
    if (promos[0]) await st.set({ selectedPromoIds: [promos[0].id] });
    return promos[0] ? `${promos[0].bank} ${promos[0].percent}%` : null;
  });
}

// Las capturas se publican: solo la categoría, sin sesión iniciada. Si alguien inicia
// sesión en la ventana o la página cambia, se corta antes de guardar nada.
async function guard(page) {
  const ok = await page.evaluate((id) => {
    const top = document.body.innerText.slice(0, 400);
    return location.pathname.includes(id) && /Ingresar/.test(top) && !/Envío a/i.test(top);
  }, CAT_ID);
  if (!ok) throw new Error("La página no es la categoría sin sesión: no guardo la captura.");
}
const shot = async (page, name, opts = {}) => { await guard(page); await page.screenshot({ path: `${OUT}/${name}.png`, ...opts }); };
// Deja el título de la grilla arriba: se ven el orden y la primera fila de productos.
const toGrid = (page) => page.evaluate(() => {
  const h = [...document.querySelectorAll("small, span, p, div")].find((e) => /productos encontrados/i.test(e.textContent) && e.children.length === 0);
  if (h) scrollTo(0, h.getBoundingClientRect().top + scrollY - 200);
});
const card = (page, name) => page.locator(".producto-card", { hasText: name }).first();

// Antes
const before = await open({ withGondola: false, video: true });
await before.page.evaluate(() => scrollTo(0, 0));
await shot(before.page, "lista-antes");
await toGrid(before.page);
await before.page.waitForTimeout(600);
await shot(before.page, "grilla-antes");
const target = await before.page.locator(".producto-card .nombre-producto").nth(1).textContent();
// PRODUCT elige el producto de las tarjetas; si no, el segundo de la grilla.
const name = process.env.PRODUCT ?? target.trim();
await card(before.page, name).scrollIntoViewIfNeeded();
await guard(before.page);
await card(before.page, name).screenshot({ path: `${OUT}/tarjeta-antes.png` });
await before.page.evaluate(() => scrollTo({ top: 0 }));
await before.page.locator("#plpSort").click().catch(() => {});
await before.page.waitForTimeout(800);
await shot(before.page, "orden-antes");
await before.page.keyboard.press("Escape");
await before.page.mouse.wheel(0, 500);
await before.page.waitForTimeout(1200);
await before.context.close();

// Después
const after = await open({ withGondola: true, video: true });
const bank = await pickBank(after.page);
await after.page.waitForSelector(".coto-unit-price", { timeout: 20000 });
await after.page.waitForFunction(() => !document.querySelector(".coto-unit-cmp[data-state='pending']"), null, { timeout: 25000 }).catch(() => {});
await after.page.waitForTimeout(1500);
await after.page.evaluate(() => scrollTo(0, 0));
await shot(after.page, "lista-despues");
await toGrid(after.page);
await after.page.waitForTimeout(600);
await shot(after.page, "grilla-despues");
await card(after.page, name).scrollIntoViewIfNeeded();
await after.page.waitForTimeout(500);
await card(after.page, name).locator(".coto-unit-cmp:not([data-state=pending])").waitFor({ timeout: 20000 }).catch(() => {});
await after.page.waitForTimeout(300);
await guard(after.page);
await card(after.page, name).screenshot({ path: `${OUT}/tarjeta-despues.png` });

// Comparación: el detalle que se abre al pasar el mouse.
// Prefiere un producto que también vende otro súper, así el detalle muestra precios.
const found = after.page.locator(".producto-card", { has: after.page.locator(".coto-unit-cmp[data-state=worse], .coto-unit-cmp[data-state=better]") }).first();
const cmpCard = process.env.PRODUCT || !(await found.count()) ? card(after.page, name) : found;
const pill = cmpCard.locator(".coto-unit-cmp-btn");
if (await pill.count()) {
  await cmpCard.scrollIntoViewIfNeeded();
  await pill.hover();
  await after.page.waitForTimeout(600);
  const box = await cmpCard.boundingBox();
  await shot(after.page, "comparar-despues", { clip: { x: Math.max(0, box.x - 16), y: Math.max(0, box.y + box.height - 330), width: box.width + 32, height: 400 } });
  await after.page.mouse.move(5, 5);
}

// Orden por precio por kilo.
await after.page.evaluate(() => scrollTo({ top: 0 }));
const options = await after.page.locator("#plpSort option").evaluateAll((os) => os.map((o) => ({ value: o.value, text: o.textContent.trim() })));
const unit = options.find((o) => /kg/i.test(o.text));
if (unit) {
  await after.page.selectOption("#plpSort", unit.value);
  await after.page.waitForTimeout(4000);
  await after.page.waitForFunction(() => !document.querySelector(".coto-unit-cmp[data-state='pending']"), null, { timeout: 25000 }).catch(() => {});
  await after.page.evaluate(() => scrollTo(0, 0));
  await shot(after.page, "orden-despues");
  await toGrid(after.page);
  await after.page.waitForTimeout(600);
  await shot(after.page, "grilla-orden");
}
await after.page.mouse.wheel(0, 500);
await after.page.waitForTimeout(1200);
await after.context.close();
await browser.close();
console.log(JSON.stringify({ product: name, bank, sort: unit?.text ?? null, out: OUT }));
