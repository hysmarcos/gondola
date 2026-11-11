// Íconos de alérgenos de la Food Standards Agency (Reino Unido), licencia Open Government
// Licence v3.0: https://www.gov.uk/government/publications/download-your-allergen-icons-and-posters
// Baja la lámina oficial de 14 íconos (960 × 640) y recorta cada círculo, sin el nombre en
// inglés: Góndola muestra el nombre en español al lado, como pide la FSA.
// Uso: node scripts/allergen-icons.mjs
import { mkdir, writeFile } from "node:fs/promises";
import { Resvg } from "@resvg/resvg-js";

const SHEET = "https://assets.publishing.service.gov.uk/media/6a6ca57a0c36759b5ccaa2e7/s960_Allergen_icons.png";
const R = 74; // medio lado del recorte, en px de la lámina
const SIZE = 96; // px del PNG final

// Centro de cada círculo en la lámina.
const ICONS = {
  "tree-nuts": [92, 108], "sulphites": [286, 108], "sesame": [480, 108], "peanuts": [676, 108], "molluscs": [870, 108],
  "mustard": [185, 307], "lupin": [382, 307], "milk": [577, 307], "fish": [770, 307],
  "gluten": [92, 505], "eggs": [286, 505], "crustaceans": [480, 505], "celery": [676, 505], "soybeans": [870, 505],
};

const res = await fetch(SHEET);
if (!res.ok) throw new Error(`lámina: HTTP ${res.status}`);
const png = Buffer.from(await res.arrayBuffer()).toString("base64");
await mkdir("assets/allergens", { recursive: true });
for (const [name, [x, y]] of Object.entries(ICONS)) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="${x - R} ${y - R} ${R * 2} ${R * 2}" width="${SIZE}" height="${SIZE}"><image width="960" height="640" xlink:href="data:image/png;base64,${png}"/></svg>`;
  await writeFile(`assets/allergens/${name}.png`, new Resvg(svg, { fitTo: { mode: "width", value: SIZE } }).render().asPng());
}
console.log("assets/allergens:", Object.keys(ICONS).length, "íconos");
