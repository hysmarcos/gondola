// Imágenes de la ficha de la Chrome Web Store: 5 capturas de 1280x800, el mosaico chico
// (440x280) y el de marquesina (1400x560). Salen a docs/store/.
// Entrada: las capturas de capture-readme.mjs (docs/img/readme/raw).
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

const R = `${RAW}/raw`;
const frame = async (file, width, extra = "") => `<div class="frame" style="width:${width}px;${extra}"><img src="${await img(`${R}/${file}`)}"></div>`;
// Una captura alta, recortada desde arriba para que entre en la placa.
const top = async (file, width, height, zoom = 1) => `<div class="frame" style="width:${width}px; height:${height}px"><img style="width:${zoom * 100}%; max-width:none" src="${await img(`${R}/${file}`)}"></div>`;

const pages = [
  {
    out: "captura-1-lista.png", w: 1280, h: 800,
    html: shot({
      title: "Coto, más claro y ordenado por kilo",
      sub: "Un diseño nuevo para la lista. Un precio grande, el precio por kilo o litro real, tu banco y el más barato de la categoría.",
      art: await top("grilla-orden.png", 720, 640),
    }),
  },
  {
    out: "captura-2-producto.png", w: 1280, h: 800,
    html: shot({
      title: "Todo para decidir, al lado de Agregar",
      sub: "El precio real, si tu banco aplica y cuánto sale el mismo producto en Carrefour, Día y Más.",
      art: await frame("pdp-despues.png", 740),
    }),
  },
  {
    out: "captura-3-nutricion.png", w: 1280, h: 800,
    html: shot({
      title: "Información nutricional y Sin TACC",
      sub: "La tabla de Open Food Facts, alérgenos, ingredientes y NOVA. Y cuánto rinde por proteína.",
      art: await frame("pdp-nutricion-despues.png", 740),
    }),
  },
  {
    out: "captura-4-comparar.png", w: 1280, h: 800,
    html: shot({
      title: "El mismo producto en otros súper",
      sub: "Por código de barras, en Carrefour, Día y Más. Una línea dice si conviene y el detalle trae el link.",
      art: `${await frame("tarjeta-antes.png", 290, "opacity:.75")}${await frame("comparar-despues.png", 330)}`,
    }),
  },
  {
    out: "captura-5-tarjetas.png", w: 1280, h: 800,
    html: shot({
      title: "Tus tarjetas, tu día y tus alergias",
      sub: "Elegí tus bancos una vez. Con tu perfil, la lista marca los productos que declaran tus alergias.",
      art: `${await frame("popup-tarjetas.png", 300)}${await top("grilla-perfil.png", 400, 545, 2)}`,
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
      <body><div><div class="lock">${icon}<h1>Góndola</h1></div><p><b>Tu súper, mejorado.</b><br>Diseño más claro, precio por kilo, tu banco, otros súper y nutrición, en la web de Coto.</p></div>${await top("grilla-orden.png", 640, 440)}</body>`,
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
