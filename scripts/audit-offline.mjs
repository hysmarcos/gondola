// Corre la auditoría sobre dist-dev/catalog.json (sin red) y guarda dist-dev/report.json.
import { readFile, writeFile } from "node:fs/promises";
import { auditItems } from "../src/audit.js";

const items = JSON.parse(await readFile("dist-dev/catalog.json", "utf8"));
const r = auditItems(items, "200");
await writeFile("dist-dev/report.json", JSON.stringify(r, null, 1));
const byCat = (list) => Object.entries(list.reduce((a, x) => ((a[x.cat] = (a[x.cat] || 0) + 1), a), {})).sort((a, b) => b[1] - a[1]);
console.log(JSON.stringify({
  counts: r.counts,
  noUnit: r.noUnit.length, noUnitByCat: byCat(r.noUnit).slice(0, 12),
  outliers: r.outliers.length, sizeMismatch: r.sizeMismatch.length,
}, null, 1));
