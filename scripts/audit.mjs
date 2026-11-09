// Arma dist-dev/: una página local que baja el catálogo de Coto y lo guarda en
// dist-dev/catalog.json (vía scripts/dev-server.mjs). Después: node scripts/audit-offline.mjs
import { build } from "esbuild";
import { mkdir, copyFile, writeFile } from "node:fs/promises";

await mkdir("dist-dev", { recursive: true });
await copyFile("scripts/leaves.json", "dist-dev/leaves.json");
await build({
  stdin: {
    contents: `import { downloadCatalog } from "./src/audit.js";
const out = document.getElementById("out");
const leaves = await fetch("leaves.json").then((r) => r.json());
out.textContent = "Bajando " + leaves.length + " categorías…";
const t0 = Date.now();
const items = await downloadCatalog({ fetchJson: (u) => fetch(u).then((r) => r.json()), leaves });
await fetch("/save", { method: "POST", body: JSON.stringify(items) });
out.textContent = "Listo: " + items.length + " productos en " + Math.round((Date.now() - t0) / 1000) + " s";`,
    resolveDir: ".",
  },
  bundle: true, format: "esm", outfile: "dist-dev/audit.js", logLevel: "info",
});
await writeFile("dist-dev/audit.html", '<!doctype html><meta charset="utf-8"><title>Auditoría Coto</title><pre id="out">…</pre><script type="module" src="audit.js"></script>');
