// Descarga promos de banco (Más, Día, Carrefour) y un carrito simulado para los tests.
import { writeFile, mkdir } from "node:fs/promises";
import { STORES } from "../src/stores.js";
import { searchUrl, parseSearch, simulationRequest } from "../src/vtex.js";

const HEADERS = { "user-agent": "Mozilla/5.0" };
const EANS = ["7790060023684", "7793704000928", "7790742348302", "7790895000997", "7790070336309"];
const QTYS = [1, 2, 3, 1, 2];
const MAS = "https://www.masonline.com.ar/_v/private/gdn-services/content";
const PROMO_FIELDS =
  "id,title,sub_title,discount_percentage,discount_text_info,active,active_from,active_to,ecommerce,monday,tuesday,wednesday,thursday,friday,saturday,sunday,idBank,idCard,legal";

async function get(url, kind) {
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return kind === "json" ? res.json() : res.text();
}

async function save(path, content) {
  await writeFile(path, content);
  console.log(path, `${(Buffer.byteLength(content) / 1024).toFixed(1)} KB`);
}

await mkdir("tests/fixtures", { recursive: true });
const capturedAt = new Date().toISOString();

// Más: promos y bancos en JSON.
const promos = await get(`${MAS}/banks-promotions?_fields=${PROMO_FIELDS}&_from=0&_to=99`, "json");
const banks = await get(`${MAS}/financing-banks?_fields=id,name&_from=0&_to=99`, "json");
await save("tests/fixtures/bank-mas.json", JSON.stringify({ capturedAt, promos, banks }, null, 1));

// Día y Carrefour: HTML crudo.
await save("tests/fixtures/bank-dia.html", await get("https://diaonline.supermercadosdia.com.ar/medios-de-pago-y-promociones", "text"));
await save("tests/fixtures/bank-carrefour.html", await get("https://www.carrefour.com.ar/descuentos-bancarios", "text"));

// Carrito: los 5 EAN en un solo pedido de simulación por súper.
const cart = { capturedAt };
for (const store of STORES) {
  const search = await get(searchUrl(store, EANS), "json");
  const hits = parseSearch(search);
  const items = [];
  EANS.forEach((ean, i) => {
    const hit = hits.get(ean);
    if (hit) items.push({ id: hit.itemId, quantity: QTYS[i], seller: hit.seller });
  });
  const { url, init } = simulationRequest(store, [...hits.values()][0], 1);
  const r = await fetch(url, { ...init, headers: { ...init.headers, ...HEADERS }, body: JSON.stringify({ items, country: "ARG" }) });
  if (!r.ok) throw new Error(`${store.id}: simulación HTTP ${r.status}`);
  cart[store.id] = { search, simulation: await r.json() };
  console.log(store.id, items.length, "ítems en el carrito");
}
await save("tests/fixtures/vtex-cart.json", JSON.stringify(cart, null, 1));
