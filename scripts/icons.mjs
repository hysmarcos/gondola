// Genera los PNG del ícono desde assets/icon/*.svg.
// 16 px usa la versión simple. 128 px deja 16 px de margen transparente por lado,
// como pide la Chrome Web Store (ícono de 96 px dentro de 128).
import { readFile, writeFile } from "node:fs/promises";
import { Resvg } from "@resvg/resvg-js";

const dir = "assets/icon";
const full = await readFile(`${dir}/icon.svg`, "utf8");
const small = await readFile(`${dir}/icon-16.svg`, "utf8");

const render = (svg, size) => new Resvg(svg, { fitTo: { mode: "width", value: size } }).render().asPng();

// Envuelve el ícono de 96 en un lienzo de 128 con margen transparente.
const padded = full.replace('viewBox="0 0 96 96" width="96" height="96"', 'viewBox="-16 -16 128 128" width="128" height="128"');

const out = { 16: render(small, 16), 32: render(full, 32), 48: render(full, 48), 128: render(padded, 128) };
// El sitio de GitHub Pages (site/) usa una copia del SVG.
await writeFile("site/icon.svg", full);

for (const [size, png] of Object.entries(out)) {
  await writeFile(`${dir}/icon-${size}.png`, png);
  console.log(`${dir}/icon-${size}.png`);
}
