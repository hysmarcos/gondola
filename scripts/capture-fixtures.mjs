// Descarga respuestas reales de la API de Coto para usarlas en los tests.
import { writeFile, mkdir } from "node:fs/promises";

const API = "https://api.coto.com.ar/api/v1/ms-digital-sitio-bff-web/api/v1/products/";
const QUERY =
  "key=key_r6xzz4IAoTWcipni&pre_filter_expression=%7B%22name%22:%22store_availability%22,%22value%22:%22200%22%7D" +
  "&c=cio-fe-web-coto-4.6.0&us=200&num_results_per_page=200&page=1";

const targets = [
  ["categories/catv00001869", "pastas-rellenas.json"],
  ["search/aceite", "aceite.json"],
  ["search/busqueda", "busqueda-mixta.json"],
];

await mkdir("tests/fixtures", { recursive: true });
for (const [path, file] of targets) {
  const res = await fetch(`${API}${path}?${QUERY}`);
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  const json = await res.json();
  await writeFile(`tests/fixtures/${file}`, JSON.stringify(json, null, 1));
  console.log(file, json.response.results.length, "de", json.response.total_num_results);
}
