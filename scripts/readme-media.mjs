// Arma las imágenes "antes y después" del README con las capturas de capture-readme.mjs.
// Arma también la animación (gondola-demo.gif y .mp4) con ffmpeg.
// Entrada: docs/img/readme/raw. Salida: docs/img/readme/
// Uso: node scripts/readme-media.mjs   (CHROME_PATH=ruta a Chrome si Playwright no trae uno)
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
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

const shots = [
  {
    out: "orden",
    title: "La lista de productos",
    sub: "Leches: 93 productos. La misma página, sin Góndola y con Góndola.",
    before: `<img class="shot" src="${await img("raw/grilla-antes.png")}">`,
    after: `<img class="shot" src="${await img("raw/grilla-orden.png")}">`,
    beforeNotes: ["Tres productos por fila y varios precios para leer en cada uno.", "Solo ordena por relevancia, nombre o precio del paquete."],
    afterNotes: ["<b>Diseño Góndola</b>: cuatro por fila, con el precio, el botón y los textos a la misma altura.", "<b>Nueva opción</b> en \"Ordenar por\": precio por kg/L, de menor a mayor.", "<b>Más barato de la categoría</b>, marcado en la foto.", "<b>Tu banco</b>: el precio con la promo de tu tarjeta, si Coto la aplica."],
  },
  {
    out: "tarjeta",
    title: "La tarjeta de cada producto",
    sub: "Mismo producto, misma página. Leche con 25% llevando 2.",
    before: `<img class="shot card" src="${await img("raw/tarjeta-antes.png")}">`,
    after: `<img class="shot card" src="${await img("raw/tarjeta-despues.png")}">`,
    beforeNotes: ["Cuatro precios distintos para leer.", "El precio por litro es el de lista: no cuenta la oferta."],
    afterNotes: ["<b>Un precio grande</b>: lo que pagás por unidad con la oferta, y el original tachado.", "<b>Precio por litro real</b>, con la oferta: $2.429/L, no $3.244.", "Una línea dice si conviene en otro súper."],
  },
  {
    out: "producto",
    title: "La página de producto",
    sub: "Todo lo que hace falta para decidir, al lado del botón Agregar.",
    before: `<img class="shot" src="${await img("raw/pdp-antes.png")}">`,
    after: `<img class="shot" src="${await img("raw/pdp-despues.png")}">`,
    beforeNotes: ["El precio por litro es el de lista.", "No dice si tu banco aplica ni cuánto sale en otro súper."],
    afterNotes: ["<b>Caja de compra</b> fija: precio, precio por litro real y el botón Agregar de Coto.", "<b>Con tu banco</b>: el precio con la promo, o por qué no aplica.", "<b>El mismo producto en otros súper</b>, con el link.", "Un resumen de calorías, azúcares y sodio."],
  },
  {
    out: "nutricion",
    title: "Información nutricional",
    sub: "Datos de Open Food Facts, por código de barras.",
    before: `<img class="shot" src="${await img("raw/pdp-info-antes.png")}">`,
    after: `<img class="shot" src="${await img("raw/pdp-nutricion-despues.png")}">`,
    beforeNotes: ["Coto no muestra la tabla nutricional."],
    afterNotes: ["<b>Tabla nutricional</b> cada 100 o por porción, con el % de valor diario.", "<b>Sin TACC</b> (dato de Coto), alérgenos, ingredientes y NOVA.", "Cuánto <b>rinde</b>: precio cada 100 g de proteína."],
  },
  {
    out: "comparar",
    title: "El mismo producto en otros súper",
    sub: "Por código de barras, en Carrefour, Día y Más.",
    before: `<img class="shot card" src="${await img("raw/tarjeta-antes.png")}">`,
    after: `<img class="shot card" src="${await img("raw/comparar-despues.png")}">`,
    beforeNotes: ["Para comparar, hay que buscar producto por producto en otra pestaña."],
    afterNotes: ["<b>Una línea</b> dice si conviene: Mejor precio, Igual o Más barato en otro súper.", "Al tocarla, <b>el detalle</b>: precio, diferencia y link a cada súper."],
  },
  {
    out: "alergias",
    title: "Tus alergias, en la lista",
    sub: "Perfil de ejemplo: alergia a la leche y celiaquía.",
    before: `<img class="shot" src="${await img("raw/grilla-antes.png")}">`,
    after: `<img class="shot" src="${await img("raw/grilla-perfil.png")}">`,
    beforeNotes: ["Hay que abrir cada producto y leer el envase."],
    afterNotes: ["<b>Tiene leche</b>: el producto declara un alérgeno de tu perfil.", "<b>Alergias: sin dato</b>: Open Food Facts no tiene el dato. Sin etiqueta no significa que sea seguro.", "Tu perfil queda solo en tu navegador."],
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

// Animación del README: una placa por captura, de antes a después.
const SLIDE = `
* { box-sizing: border-box; margin: 0; }
body { width: 1280px; height: 720px; overflow: hidden; background: #f3f2ee; font-family: Poppins, "Segoe UI", system-ui, sans-serif; color: #0b0b0b; display: grid; grid-template-rows: 84px 1fr; }
header { display: flex; align-items: center; gap: 14px; padding: 0 32px; background: #14284b; color: #fff; }
header svg { width: 40px; height: 40px; flex: none; }
h1 { font-size: 26px; font-weight: 700; flex: 1; }
.tag { padding: 7px 18px; border-radius: 999px; font-size: 18px; font-weight: 600; }
.tag.before { background: #e6e5df; color: #2b2b29; }
.tag.after { background: #ffc233; color: #14284b; }
main { padding: 22px 32px; display: grid; place-items: center; min-height: 0; height: 636px; }
img { display: block; border-radius: 14px; background: #fff; box-shadow: 0 14px 40px rgba(20, 40, 75, 0.18); }
img.wide { width: 100%; height: 592px; object-fit: cover; object-position: top; }
img.tall { height: 592px; }
`;
const slides = [
  ["La lista de productos", "before", "raw/grilla-antes.png", "wide"],
  ["Ordenada por precio por litro, con tu banco", "after", "raw/grilla-orden.png", "wide"],
  ["La página de producto", "before", "raw/pdp-antes.png", "wide"],
  ["Precio real, tu banco y otros súper", "after", "raw/pdp-despues.png", "wide"],
  ["Información nutricional y Sin TACC", "after", "raw/pdp-nutricion-despues.png", "wide"],
  ["El mismo producto en otros súper", "after", "raw/comparar-despues.png", "tall"],
  ["Tus alergias, en la lista", "after", "raw/grilla-perfil.png", "wide"],
];
await tab.setViewportSize({ width: 1280, height: 720 });
for (const [i, [title, kind, src, fit]] of slides.entries()) {
  const file = resolve(`${TMP}/placa-${i}.html`);
  await writeFile(file, `<!doctype html><html lang="es"><meta charset="utf-8"><style>${SLIDE}</style><body><header>${icon}<h1>${title}</h1><span class="tag ${kind}">${kind === "before" ? "Antes · coto.com.ar" : "Con Góndola"}</span></header><main><img class="${fit}" src="${await img(src)}"></main></body></html>`);
  await tab.goto(pathToFileURL(file).href);
  await tab.waitForLoadState("load");
  await tab.screenshot({ path: `${TMP}/placa-${i}.png`, clip: { x: 0, y: 0, width: 1280, height: 720 } });
}
await browser.close();

// Necesita ffmpeg en el PATH. Sin ffmpeg quedan las imágenes y no se toca la animación.
const SECONDS = 2.6;
const run = (args) => spawnSync("ffmpeg", ["-y", "-loglevel", "error", ...args], { stdio: "inherit" });
const input = ["-framerate", String(1 / SECONDS), "-i", `${TMP}/placa-%d.png`];
if (spawnSync("ffmpeg", ["-version"]).status === 0) {
  run([...input, "-vf", "fps=30,format=yuv420p", "-c:v", "libx264", "-crf", "20", "-movflags", "+faststart", `${DIR}/gondola-demo.mp4`]);
  run([...input, "-vf", "fps=2,scale=960:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=160[p];[b][p]paletteuse=dither=bayer:bayer_scale=4", `${DIR}/gondola-demo.gif`]);
  console.log(`${DIR}/gondola-demo.mp4`, `${DIR}/gondola-demo.gif`);
} else {
  console.log("No encontré ffmpeg: no rehíce la animación.");
}
