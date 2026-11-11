// Capturas del README y de la tienda: las mismas páginas de Coto sin Góndola (antes) y con
// la extensión real cargada (después). Sin sesión de Coto.
// Antes de correrlo: npm run build
// Uso: node scripts/capture-readme.mjs   (abre Chrome visible: no tocar la ventana mientras corre)
// Salida: docs/img/readme/raw/*.png (no se suben al repo; las usan readme-media.mjs y store-media.mjs)
import { mkdir, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { chromium } from "playwright";

const EXT = resolve(".");
const OUT = process.env.OUT ?? "docs/img/readme/raw";
const LIST = process.env.CAT ?? "https://www.coto.com.ar/productos/categorias/catalogo-frescos-l%C3%A1cteos/leches/catv00003266";
const PDP = process.env.PDP ?? "https://www.coto.com.ar/productos/leche-protein-la-serenisima-1l/_/R-00508911-00508911-200";
const BANK = new RegExp(process.env.BANK ?? "icbc", "i");
const VIEW = { width: 1280, height: 860 };
await mkdir(OUT, { recursive: true });

const launch = async (withGondola) => chromium.launchPersistentContext(await mkdtemp(join(tmpdir(), "gondola-capturas-")), {
  headless: false, viewport: VIEW, deviceScaleFactor: 2, locale: "es-AR",
  args: withGondola ? ["--disable-extensions-except=" + EXT, "--load-extension=" + EXT] : [],
});

// Las capturas se publican: si la página muestra una sesión iniciada, no se guarda nada.
async function guard(page) {
  const top = await page.evaluate(() => document.body.innerText.slice(0, 600));
  if (!/Ingresar/.test(top) || /Envío a/i.test(top)) throw new Error("Hay una sesión iniciada: no guardo la captura.");
}
const save = async (page, name, opts = {}) => { await guard(page); await page.screenshot({ path: `${OUT}/${name}.png`, ...opts }); console.log(name); };
const settle = (page, ms = 1500) => page.waitForTimeout(ms);
const compared = (page) => page.waitForFunction(() => !document.querySelector(".coto-unit-cmp[data-state='pending']"), null, { timeout: 25000 }).catch(() => {});

async function openList(page) {
  await page.goto(LIST, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".producto-card .card-container", { timeout: 45000 });
  await settle(page, 5000);
}
// La zona de productos: desde la barra de orden hasta el final de la segunda fila.
async function gridClip(page) {
  return page.evaluate(() => {
    const cards = [...document.querySelectorAll(".producto-card .card-container")].map((c) => c.getBoundingClientRect());
    const tops = [...new Set(cards.map((r) => Math.round(r.top)))].sort((a, b) => a - b).slice(0, 2);
    const rows = cards.filter((r) => tops.includes(Math.round(r.top)));
    const head = document.querySelector(".plp-header")?.getBoundingClientRect();
    const x0 = Math.min(...rows.map((r) => r.left)) - 12;
    const y0 = (head ? head.top : Math.min(...rows.map((r) => r.top))) - 12 + scrollY;
    const x1 = Math.max(...rows.map((r) => r.right)) + 12;
    const y1 = Math.max(...rows.map((r) => r.bottom)) + 12 + scrollY;
    return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
  });
}
// La comparación con otros súper corre cuando la tarjeta entra en pantalla: baja, espera y vuelve.
const saveGrid = async (page, name) => {
  await page.mouse.wheel(0, 700);
  await page.waitForFunction(() => ![...document.querySelectorAll(".producto-card")].slice(0, 8).some((c) => /Comparando/.test(c.textContent)), null, { timeout: 30000 }).catch(() => {});
  await page.evaluate(() => scrollTo(0, 0)); await settle(page, 800); await save(page, name, { clip: await gridClip(page), fullPage: true });
};
const card = (page, name) => page.locator(".producto-card", { hasText: name }).first();
const saveCard = async (page, name, file) => { const c = card(page, name); await c.scrollIntoViewIfNeeded(); await settle(page, 600); await guard(page); await c.screenshot({ path: `${OUT}/${file}.png` }); console.log(file); };

// ---------- Después: la extensión real ----------
const after = await launch(true);
let name;
try {
  const sw = after.serviceWorkers()[0] ?? (await after.waitForEvent("serviceworker", { timeout: 20000 }));
  const id = sw.url().split("/")[2];
  const page = await after.newPage();
  await openList(page);
  await page.waitForSelector("[data-coto-unit-card]", { timeout: 30000 });

  // Elige las promos de un banco, como haría alguien en el popup.
  let bank = null;
  for (let i = 0; i < 20 && !bank; i++) {
    await settle(page, 1000);
    bank = await sw.evaluate(async (src) => {
      const promos = (await chrome.storage.local.get(["promos"])).promos ?? [];
      if (!promos.length) return null;
      const re = new RegExp(src, "i");
      const pick = promos.find((p) => re.test(p.bank ?? ""))?.bank ?? promos[0].bank;
      const mine = promos.filter((p) => p.bank === pick);
      await chrome.storage.local.set({ selectedPromoIds: mine.map((p) => p.id), day: mine[0].days[0] });
      return pick;
    }, BANK.source);
  }
  await openList(page);
  await compared(page);
  await saveGrid(page, "grilla-despues");

  // La tarjeta de ejemplo: una con oferta y con respuesta de otro súper, si hay.
  name = process.env.PRODUCT ?? await page.evaluate(() => {
    const cards = [...document.querySelectorAll(".producto-card")];
    const has = (c, s) => !!c.querySelector(s);
    const best = cards.find((c) => has(c, ".coto-unit-cmp[data-state=worse], .coto-unit-cmp[data-state=better]") && has(c, ".coto-unit-old, s, del"))
      ?? cards.find((c) => has(c, ".coto-unit-cmp[data-state=worse], .coto-unit-cmp[data-state=better]")) ?? cards[1];
    return best.querySelector(".nombre-producto").textContent.trim();
  });
  await saveCard(page, name, "tarjeta-despues");

  // La comparación abierta.
  const pill = card(page, name).locator(".coto-unit-cmp-btn");
  if (await pill.count()) {
    await pill.click();
    await settle(page, 700);
    const box = await card(page, name).boundingBox();
    const panel = await page.locator(".coto-unit-cmp-panel, .coto-unit-cmp-detail, .coto-unit-cmp [role=dialog]").first().boundingBox().catch(() => null);
    const y1 = Math.max(box.y + box.height, panel ? panel.y + panel.height : 0) + 14;
    const x0 = Math.min(box.x, panel ? panel.x : box.x) - 14;
    const x1 = Math.max(box.x + box.width, panel ? panel.x + panel.width : 0) + 14;
    await save(page, "comparar-despues", { clip: { x: x0, y: box.y - 14, width: x1 - x0, height: y1 - box.y + 14 } });
    await page.keyboard.press("Escape");
    await page.mouse.click(5, 400);
  }

  // Orden por precio por kilo o litro.
  const sort = page.locator("select", { has: page.locator("option", { hasText: /kg/i }) }).first();
  const value = await sort.locator("option", { hasText: /kg/i }).first().getAttribute("value");
  await sort.selectOption(value);
  await settle(page, 5000);
  await compared(page);
  await saveGrid(page, "grilla-orden");

  // Página de producto.
  await page.goto(PDP, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("app-product-detail .price", { timeout: 45000 });
  await page.waitForSelector(".coto-unit-nutri-section", { timeout: 30000 }).catch(() => {});
  await settle(page, 6000);
  await save(page, "pdp-despues");
  const nutri = page.locator(".coto-unit-nutri-section").first();
  if (await nutri.count()) {
    await nutri.scrollIntoViewIfNeeded();
    await settle(page, 800);
    await guard(page);
    await nutri.screenshot({ path: `${OUT}/nutricion-despues.png` });
    console.log("nutricion-despues");
    await page.evaluate(() => { const n = document.querySelector(".coto-unit-nutri-section"); scrollTo(0, n.getBoundingClientRect().top + scrollY - 190); });
    await settle(page, 800);
    await save(page, "pdp-nutricion-despues");
  }

  // Perfil: alergia a la leche y celiaquía, para las etiquetas de la lista.
  await sw.evaluate(() => chrome.storage.local.set({ profileAllergens: ["milk"], profileCeliac: true }));
  await openList(page);
  await page.waitForSelector(".coto-unit-foryou > span", { timeout: 30000 }).catch(() => {});
  await settle(page, 6000);
  await saveGrid(page, "grilla-perfil");

  // El popup real.
  const pop = await after.newPage();
  await pop.setViewportSize({ width: 340, height: 560 });
  await pop.goto("chrome-extension://" + id + "/popup.html");
  await settle(pop, 1200);
  await pop.screenshot({ path: `${OUT}/popup-tarjetas.png` });
  const tab = pop.getByRole("tab", { name: /Ajustes/ });
  if (await tab.count()) { await tab.first().click(); await settle(pop, 500); await pop.screenshot({ path: `${OUT}/popup-ajustes.png`, fullPage: true }); }
  console.log("popup", JSON.stringify({ bank, product: name }));
} finally {
  await after.close();
}

// ---------- Antes: Chrome sin la extensión ----------
const before = await launch(false);
try {
  const page = await before.newPage();
  await openList(page);
  await saveGrid(page, "grilla-antes");
  await saveCard(page, name, "tarjeta-antes");
  await page.goto(PDP, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("app-product-detail .price", { timeout: 45000 });
  await settle(page, 5000);
  await save(page, "pdp-antes");
  await page.mouse.wheel(0, 700);
  await settle(page, 1500);
  await save(page, "pdp-info-antes");
} finally {
  await before.close();
}
console.log("Listo:", OUT);
