// Lectura de las APIs públicas VTEX (Carrefour, Día, Más). Funciones puras, sin red.

// URL de búsqueda por EAN. Repetir fq equivale a un OR.
export function searchUrl(store, eans) {
  const fq = eans.map((ean) => `fq=alternateIds_Ean:${ean}`).join("&");
  return `https://${store.host}/api/catalog_system/pub/products/search?${fq}&_from=0&_to=49`;
}

// Pasa la respuesta de búsqueda a un Map ean -> hit.
export function parseSearch(json) {
  const hits = new Map();
  if (!Array.isArray(json)) return hits;
  for (const product of json) {
    for (const item of product?.items ?? []) {
      if (!item?.ean) continue;
      const seller = item.sellers?.[0];
      const offer = seller?.commertialOffer;
      hits.set(String(item.ean), {
        itemId: String(item.itemId),
        seller: String(seller?.sellerId ?? "1"),
        price: Number(offer?.Price) || 0,
        stock: Number(offer?.AvailableQuantity) || 0,
        name: product.productName ?? "",
        // Link del producto en ese súper (para ir a verlo desde la comparación).
        url: typeof product.link === "string" ? product.link : null,
      });
    }
  }
  return hits;
}

// Pedido de carrito simulado para q unidades de un hit.
export function simulationRequest(store, hit, q) {
  return {
    url: `https://${store.host}/api/checkout/pub/orderForms/simulation?sc=${store.sc}`,
    init: {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ items: [{ id: hit.itemId, quantity: q, seller: hit.seller }], country: "ARG" }),
    },
  };
}

// Total en pesos y promo de una simulación; null si no sirve para q unidades.
export function parseSimulation(json, q) {
  const item = json?.items?.[0];
  if (!item || item.quantity !== q || item.availability !== "available") return null;
  const cents = (json.totals ?? []).reduce((sum, t) => sum + (Number(t.value) || 0), 0);
  const total = cents / 100;
  if (!(total > 0)) return null;
  const names = (json.ratesAndBenefitsData?.rateAndBenefitsIdentifiers ?? []).map((r) => r.name).filter(Boolean);
  return { total, promo: names.length ? names.join(" · ") : null };
}

const round2 = (n) => Math.round(n * 100) / 100;

// Mejor precio por unidad entre llevar 1, 2 o 3. Empate: la cantidad más chica.
export function bestOffer(hit, sims) {
  if (!hit || hit.stock <= 0) return null;
  let best = null;
  for (const q of [1, 2, 3]) {
    let sim = sims?.[q];
    if (q === 1 && !sim) sim = hit.price > 0 ? { total: hit.price, promo: null } : null;
    if (!sim) continue;
    const unit = round2(sim.total / q);
    if (!best || unit < best.unit) best = { unit, qty: q, promo: sim.promo ?? null, url: hit.url ?? null };
  }
  return best;
}
