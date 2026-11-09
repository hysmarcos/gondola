// Descarga respuestas reales de las APIs VTEX de Carrefour, Día y Más para los tests.
import { writeFile, mkdir } from "node:fs/promises";
import { STORES } from "../src/stores.js";
import { searchUrl, parseSearch, simulationRequest } from "../src/vtex.js";

const EANS = ["7790060023684", "7793704000928", "7790742348302", "7790895000997", "7790070336309"];
const HEADERS = { "user-agent": "Mozilla/5.0" };

await mkdir("tests/fixtures", { recursive: true });
for (const store of STORES) {
  const res = await fetch(searchUrl(store, EANS), { headers: HEADERS });
  if (!res.ok) throw new Error(`${store.id}: búsqueda HTTP ${res.status}`);
  const search = await res.json();
  const sims = {};
  for (const [ean, hit] of parseSearch(search)) {
    for (const q of [1, 2, 3]) {
      const { url, init } = simulationRequest(store, hit, q);
      const r = await fetch(url, { ...init, headers: { ...init.headers, ...HEADERS } });
      if (!r.ok) throw new Error(`${store.id} ${ean}:${q}: HTTP ${r.status}`);
      sims[`${ean}:${q}`] = await r.json();
    }
  }
  const out = { capturedAt: new Date().toISOString(), search, sims };
  await writeFile(`tests/fixtures/vtex-${store.id}.json`, JSON.stringify(out, null, 1));
  console.log(store.id, search.length, "productos,", Object.keys(sims).length, "simulaciones");
}
