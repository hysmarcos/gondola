// Arma las imágenes "antes y después" del README con las capturas de capture-readme.mjs.
// Entrada: docs/img/readme/raw (pastas) y docs/img/readme/raw-aceites (aceites). Salida: docs/img/readme/*.png
// Uso: node scripts/readme-media.mjs   (CHROME_PATH=ruta a Chrome si Playwright no trae uno)
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";

const DIR = "docs/img/readme";
const TMP = "dist-dev/readme-media";
await mkdir(TMP, { recursive: true });
const img = async (p) => "data:image/png;base64," + (await readFile(`${DIR}/${p}`)).toString("base64");
const icon = await readFile("assets/icon/icon.svg", "utf8");

const CSS = `
* { box-sizing: border-box; margin: 0; }
body { width: 1600px; padding: 48px 56px 52px; background: #fcfcfb; font-family: Poppins, "Segoe UI", system-ui, sans-serif; color: #0b0b0b; }
header { display: flex; align-items: center; gap: 16px; margin-bottom: 32px; }
header svg { width: 44px; height: 44px; flex: none; }
h1 { font-size: 34px; font-weight: 700; letter-spacing: -0.01em; }
header p { font-size: 18px; color: #52514e; margin-top: 2px; }
.cols { display: grid; grid-template-columns: 1fr 1fr; gap: 28px; align-items: start; }
.col { background: #fff; border: 1px solid #e1e0d9; border-radius: 20px; padding: 22px; }
.tag { display: inline-flex; align-items: center; gap: 8px; padding: 6px 14px; border-radius: 999px; font-size: 16px; font-weight: 600; margin-bottom: 16px; }
.tag.before { background: #f0efec; color: #52514e; }
.tag.after { background: #14284b; color: #fff; }
.tag.after::before { content: ""; width: 9px; height: 9px; border-radius: 50%; background: #ffc233; }
.shot { display: block; width: 100%; border-radius: 12px; border: 1px solid #ecebe6; }
.shot.card { width: 68%; margin: 0 auto; }
.crop { position: relative; overflow: hidden; border-radius: 12px; border: 1px solid #ecebe6; }
.crop img { display: block; }
.pair { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
ol { margin-top: 18px; padding-left: 0; list-style: none; counter-reset: n; display: grid; gap: 10px; }
li { counter-increment: n; display: grid; grid-template-columns: 28px 1fr; gap: 10px; font-size: 17px; line-height: 1.45; color: #2b2b29; }
li::before { content: counter(n); display: grid; place-items: center; width: 28px; height: 28px; border-radius: 50%; background: #ffc233; color: #14284b; font-weight: 700; font-size: 15px; }
li.muted::before { background: #e6e5df; color: #52514e; content: "–"; }
li b { color: #0b0b0b; }
`;

const page = ({ title, sub, before, after, beforeNotes = [], afterNotes = [] }) => `<!doctype html><html lang="es"><meta charset="utf-8"><style>${CSS}</style>
<body><header>${icon}<div><h1>${title}</h1><p>${sub}</p></div></header>
<div class="cols">
  <section class="col"><span class="tag before">Antes · coto.com.ar</span>${before}<ol>${beforeNotes.map((n) => `<li class="muted"><span>${n}</span></li>`).join("")}</ol></section>
  <section class="col"><span class="tag after">Con Góndola</span>${after}<ol>${afterNotes.map((n) => `<li><span>${n}</span></li>`).join("")}</ol></section>
</div></body></html>`;

// Recorta una captura de 2560 px de ancho a la zona de productos (sin menú ni filtros).
const crop = (src, [x0, y0, x1, y1]) => {
  const w = x1 - x0, h = y1 - y0;
  return `<div class="crop" style="aspect-ratio: ${w} / ${h}"><img src="${src}" style="width: ${(2560 / w) * 100}%; margin-left: -${(x0 / w) * 100}%; margin-top: -${(y0 / w) * 100}%"></div>`;
};
const GRID = [660, 230, 2490, 1330];

const shots = [
  {
    out: "tarjeta",
    title: "La tarjeta de cada producto",
    sub: "Mismo producto, misma página. Panzotti con 2x1.",
    before: `<img class="shot card" src="${await img("raw/tarjeta-antes.png")}">`,
    after: `<img class="shot card" src="${await img("raw/tarjeta-despues.png")}">`,
    beforeNotes: ["Seis precios distintos para leer.", "El precio por kilo es el de lista: no cuenta el 2x1."],
    afterNotes: ["<b>Un precio grande</b>: lo que pagás por unidad llevando 2, y el original tachado.", "<b>Precio por kilo real</b>, con la oferta: $9.597/kg, no $13.331.", "Compara con otros súper (acá es marca propia de Coto)."],
  },
  {
    out: "orden",
    title: "Ordenar por precio por kilo",
    sub: "Pastas rellenas: 79 productos de distinto tamaño.",
    before: `${crop(await img("raw/grilla-antes.png"), GRID)}`,
    after: `${crop(await img("raw/grilla-orden.png"), GRID)}`,
    beforeNotes: ["Solo ordena por relevancia, nombre o precio del paquete.", "Un paquete de 500 g y uno de 1 kg no se comparan a simple vista."],
    afterNotes: ["<b>Nueva opción</b> en \"Ordenar por\": precio por kg/L, de menor a mayor.", "<b>Más barato de la categoría</b>, marcado en la foto.", "<b>Tu banco hoy</b>: el precio con la promo de tu tarjeta, si Coto la aplica."],
  },
  {
    out: "comparar",
    title: "El mismo producto en otros súper",
    sub: "Aceite de girasol Natura 1,5 L, por código de barras.",
    before: `<img class="shot card" src="${await img("raw-aceites/tarjeta-antes.png")}">`,
    after: `<img class="shot card" src="${await img("raw-aceites/comparar-despues.png")}">`,
    beforeNotes: ["Para comparar, hay que buscar producto por producto en otra pestaña."],
    afterNotes: ["<b>Una palabra</b> dice si conviene: Mejor precio, Igual o Más barato en otro súper.", "Al pasar el mouse, <b>el detalle</b>: precio, diferencia y link a cada súper.", "Busca por código de barras en Carrefour, Día y Más."],
  },
];

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });
const tab = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
for (const s of shots) {
  const file = resolve(`${TMP}/${s.out}.html`);
  await writeFile(file, page(s));
  await tab.goto(pathToFileURL(file).href);
  await tab.waitForLoadState("load");
  await tab.screenshot({ path: `${DIR}/${s.out}.png`, fullPage: true });
  console.log(`${DIR}/${s.out}.png`);
}
await browser.close();
