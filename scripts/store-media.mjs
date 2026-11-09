// Imágenes de la ficha de la Chrome Web Store: 4 capturas de 1280x800, el mosaico chico
// (440x280) y el de marquesina (1400x560). Salen a docs/store/.
// Entrada: las capturas de capture-readme.mjs (docs/img/readme/raw*) y el popup del
// servidor local (node scripts/dev-server.mjs).
// Uso: node scripts/store-media.mjs   (CHROME_PATH=ruta a Chrome si Playwright no trae uno)
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";

const RAW = "docs/img/readme";
const OUT = "docs/store";
const TMP = "dist-dev/store-media";
await mkdir(OUT, { recursive: true });
await mkdir(TMP, { recursive: true });

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });
const b64 = (buf) => "data:image/png;base64," + buf.toString("base64");
const img = async (p) => b64(await readFile(p));
const icon = await readFile("assets/icon/icon.svg", "utf8");

// El popup real, con promos de ejemplo, desde la vista previa local.
const pop = await browser.newPage({ viewport: { width: 420, height: 640 }, deviceScaleFactor: 2 });
await pop.goto("http://127.0.0.1:8765/dist-dev/popup-preview.html?tab=tarjetas");
await pop.waitForSelector("details.bank");
await pop.waitForTimeout(500);
const popup = b64(await pop.locator("body").screenshot());
await pop.close();

// Recorta una captura de 2560 px de ancho a la zona de productos.
const crop = (src, [x0, y0, x1, y1], width) => {
  const w = x1 - x0, h = y1 - y0;
  return `<div class="crop" style="width:${width}px; aspect-ratio:${w}/${h}"><img src="${src}" style="width:${(2560 / w) * 100}%; margin-left:-${(x0 / w) * 100}%; margin-top:-${(y0 / w) * 100}%"></div>`;
};
const GRID = [660, 230, 2490, 1330];

const FONTS = [400, 600, 700].map((w) => `@font-face { font-family: Poppins; font-weight: ${w}; src: url("${pathToFileURL(resolve(`assets/fonts/poppins-latin-${Math.min(w, 600)}-normal.woff2`)).href}") format("woff2"); }`).join(" ");
const BASE = `${FONTS}
* { box-sizing: border-box; margin: 0; }
body { font-family: Poppins, "Segoe UI", system-ui, sans-serif; color: #0b0b0b; overflow: hidden; }
.crop { overflow: hidden; border-radius: 14px; background: #fff; box-shadow: 0 18px 50px rgba(20, 40, 75, 0.16); }
.crop img { display: block; }
.frame { border-radius: 18px; background: #fff; box-shadow: 0 18px 50px rgba(20, 40, 75, 0.16); overflow: hidden; }
.frame img { display: block; width: 100%; }
`;

const shot = ({ title, sub, art }) => `<style>${BASE}
body { width: 1280px; height: 800px; background: #f3f2ee; display: grid; grid-template-columns: 420px 1fr; align-items: center; gap: 40px; padding: 0 56px; }
.brand { display: flex; align-items: center; gap: 12px; font-size: 22px; font-weight: 700; color: #14284b; margin-bottom: 26px; }
.brand svg { width: 40px; height: 40px; }
h1 { font-size: 44px; line-height: 1.15; letter-spacing: -0.02em; }
p { margin-top: 18px; font-size: 21px; line-height: 1.45; color: #52514e; }
.art { display: flex; justify-content: center; align-items: center; gap: 22px; }
</style><body><div><div class="brand">${icon}Góndola</div><h1>${title}</h1><p>${sub}</p></div><div class="art">${art}</div></body>`;

const pages = [
  {
    out: "captura-1-orden.png", w: 1280, h: 800,
    html: shot({
      title: "Ordená por precio por kilo",
      sub: "Una opción nueva en \"Ordenar por\". Con la oferta y tu banco. El más barato de la categoría, marcado.",
      art: crop(await img(`${RAW}/raw/grilla-orden.png`), GRID, 720),
    }),
  },
  {
    out: "captura-2-tarjeta.png", w: 1280, h: 800,
    html: shot({
      title: "Un precio claro, y el kilo de verdad",
      sub: "El precio final grande, el original tachado y el precio por kilo con el 2x1. Coto a la izquierda, con Góndola a la derecha.",
      art: `<div class="frame" style="width:300px; opacity:.75"><img src="${await img(`${RAW}/raw/tarjeta-antes.png`)}"></div><div class="frame" style="width:330px"><img src="${await img(`${RAW}/raw/tarjeta-despues.png`)}"></div>`,
    }),
  },
  {
    out: "captura-3-comparar.png", w: 1280, h: 800,
    html: shot({
      title: "El mismo producto en otros súper",
      sub: "Por código de barras, en Carrefour, Día y Más. Una palabra dice si conviene y el detalle trae el link.",
      art: `<div class="frame" style="width:470px"><img src="${await img(`${RAW}/raw-aceites/comparar-despues.png`)}"></div>`,
    }),
  },
  {
    out: "captura-4-tarjetas.png", w: 1280, h: 800,
    html: shot({
      title: "Tus tarjetas y el día de compra",
      sub: "Elegí tus bancos una vez. Ves el precio con la promo solo si Coto la aplica a ese producto.",
      art: `<div class="frame" style="width:360px"><img src="${popup}"></div>`,
    }),
  },
  {
    out: "mosaico-chico-440x280.png", w: 440, h: 280,
    html: `<style>${BASE} body { width: 440px; height: 280px; background: #14284b; color: #fff; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; }
      svg { width: 96px; height: 96px; border-radius: 22px; box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.28); } h1 { font-size: 40px; letter-spacing: -0.02em; } p { font-size: 18px; color: #ffc233; font-weight: 600; }</style>
      <body>${icon}<h1>Góndola</h1><p>Tu súper, mejorado.</p></body>`,
  },
  {
    out: "marquesina-1400x560.png", w: 1400, h: 560,
    html: `<style>${BASE} body { width: 1400px; height: 560px; background: #14284b; color: #fff; display: grid; grid-template-columns: 1fr 640px; align-items: center; padding: 0 70px; gap: 50px; }
      .lock { display: flex; align-items: center; gap: 22px; } svg { width: 110px; height: 110px; border-radius: 25px; box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.28); } h1 { font-size: 76px; letter-spacing: -0.03em; }
      p { margin-top: 22px; font-size: 30px; line-height: 1.35; color: #e8e7e2; } b { color: #ffc233; }</style>
      <body><div><div class="lock">${icon}<h1>Góndola</h1></div><p><b>Tu súper, mejorado.</b><br>Precio por kilo, tu banco y otros súper, en la web de Coto.</p></div>${crop(await img(`${RAW}/raw/grilla-orden.png`), [660, 230, 2490, 1330], 640)}</body>`,
  },
];

const tab = await browser.newPage({ deviceScaleFactor: 1 });
for (const p of pages) {
  const file = resolve(`${TMP}/${p.out}.html`);
  await writeFile(file, `<!doctype html><html lang="es"><meta charset="utf-8">${p.html}</html>`);
  await tab.setViewportSize({ width: p.w, height: p.h });
  await tab.goto(pathToFileURL(file).href);
  await tab.waitForLoadState("load");
  await tab.screenshot({ path: `${OUT}/${p.out}`, clip: { x: 0, y: 0, width: p.w, height: p.h } });
  console.log(`${OUT}/${p.out}`);
}
await browser.close();
