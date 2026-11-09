// Arma el ZIP para subir a la Chrome Web Store: release/gondola-<versión>.zip.
// Uso: npm run package   (corre el build antes)
import { readFile, readdir, mkdir, writeFile, stat } from "node:fs/promises";
import { zipSync } from "fflate";
import { packageFiles, manifestRefs, missingRefs } from "./package-lib.mjs";

const manifest = JSON.parse(await readFile("manifest.json", "utf8"));
const popup = await readFile("popup.html", "utf8");

// Límites de la tienda: nombre hasta 75 caracteres, descripción hasta 132.
const errors = [];
if (manifest.name.length > 75) errors.push(`El nombre tiene ${manifest.name.length} caracteres (máximo 75).`);
if (manifest.description.length > 132) errors.push(`La descripción tiene ${manifest.description.length} caracteres (máximo 132).`);

const walk = async (dir) => (await readdir(dir, { recursive: true, withFileTypes: true })).filter((d) => d.isFile()).map((d) => `${d.parentPath ?? d.path}/${d.name}`.replaceAll("\\", "/"));
const all = ["manifest.json", "popup.html", "LICENSE", ...(await walk("dist")), ...(await walk("src")), ...(await walk("assets"))];
const files = packageFiles(all);
const missing = missingRefs(manifestRefs(manifest, popup), files);
if (missing.length) errors.push(`Faltan archivos que pide la extensión: ${missing.join(", ")}. ¿Corriste npm run build?`);

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}

const entries = {};
for (const f of files) entries[f] = [new Uint8Array(await readFile(f)), { level: 9 }];
const zip = zipSync(entries);
await mkdir("release", { recursive: true });
const out = `release/gondola-${manifest.version}.zip`;
await writeFile(out, zip);
const kb = Math.round((await stat(out)).size / 1024);
console.log(`${out} · ${files.length} archivos · ${kb} KB`);
