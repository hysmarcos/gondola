// Descarga respuestas reales de Open Food Facts para los tests de información nutricional.
import { readFile, writeFile } from "node:fs/promises";
import { offApiUrl } from "../src/nutrition.js";

const EANS = {
  "7790895000997": "Coca-Cola 2,25 L (tabla cada 100 ml)",
  "7790040613706": "galletitas con valores por porción",
  "7790040143524": "Rumba 330 g: ficha sin tabla",
  "7798078450393": "Arroz Vanguardia 500 g: no existe",
};

const { version } = JSON.parse(await readFile("manifest.json", "utf8"));
const headers = { "User-Agent": `Gondola/${version} (github.com/hysmarcos/gondola)` };

// Open Food Facts a veces tarda o responde 503: hasta 3 intentos, 5 s entre cada uno.
async function get(ean) {
  for (let i = 0; i < 3; i++) {
    const res = await fetch(offApiUrl(ean), { headers }).catch(() => null);
    if (res && (res.ok || res.status === 404)) return res.json();
    await new Promise((r) => setTimeout(r, 5000));
  }
  throw new Error(`${ean}: sin respuesta`);
}

const out = {};
for (const ean of Object.keys(EANS)) out[ean] = await get(ean);

const notes = Object.entries(EANS).map(([e, n]) => `//   ${e}: ${n}`).join("\n");
const date = new Date().toISOString().slice(0, 10);
await writeFile(
  "tests/fixtures/off.js",
  `// Respuestas reales de Open Food Facts (API v2), tomadas el ${date}.\n${notes}\nexport const OFF = ${JSON.stringify(out, null, 1)};\n`,
);
console.log("off.js:", Object.keys(out).length, "productos");
