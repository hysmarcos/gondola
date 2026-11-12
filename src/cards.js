// Las tarjetas del usuario: una sola billetera que vale para Coto y para los otros súper.

const c = (id, name, plans = []) => ({ id, name, plans });

export const CARDS = [
  c("icbc", "ICBC", [{ id: "sueldo", name: "Plan Sueldo" }]),
  c("supervielle", "Supervielle", [{ id: "identite", name: "Identité" }]),
  c("naranjax", "Naranja X", [{ id: "inicial", name: "Inicial" }, { id: "turbo", name: "Turbo" }, { id: "epico", name: "Épico" }]),
  c("columbia", "Columbia"), c("tci", "TCI"), c("patagonia", "Patagonia"), c("ciudad", "Ciudad"),
  c("credicoop", "Credicoop"), c("comafi", "Comafi"), c("galicia", "Galicia"), c("nacion", "Nación"),
  c("macro", "Macro"), c("santander", "Santander"), c("bbva", "BBVA"), c("modo", "MODO"),
  c("mercadopago", "Mercado Pago"), c("personalpay", "Personal Pay"), c("cuentadni", "Cuenta DNI"),
  c("bancodelsol", "Banco del Sol"), c("carrefourbanco", "Carrefour Banco"), c("masclub", "Más Club"),
];

// Lo que viene de storage puede estar roto: se queda solo lo que se conoce.
export function cleanCards(value) {
  const out = {};
  if (!value || typeof value !== "object" || Array.isArray(value)) return out;
  for (const card of CARDS) {
    const entry = Object.hasOwn(value, card.id) ? value[card.id] : undefined;
    if (!entry || typeof entry !== "object") continue;
    out[card.id] = { plan: card.plans.some((p) => p.id === entry.plan) ? entry.plan : null };
  }
  return out;
}

// ref: { cardId, plan } que pide la promo. plan null = sirve cualquier plan.
export function applies(cards, ref) {
  if (!ref || !cards || !Object.hasOwn(cards, ref.cardId)) return false;
  const mine = cards[ref.cardId];
  return !!mine && (ref.plan === null || ref.plan === mine.plan);
}

// Pasa las promos elegidas a mano a tarjetas, una sola vez. null = nada que migrar.
export function migrateCards(s, cardOf) {
  if (s?.cards || !Array.isArray(s?.selectedPromoIds)) return null;
  const ids = new Set(s.selectedPromoIds);
  const best = {};
  for (const p of s.promos ?? []) {
    if (!ids.has(p.id)) continue;
    const ref = cardOf(p);
    if (!ref || !CARDS.some((k) => k.id === ref.cardId)) continue;
    // Entre promos del mismo banco con planes distintos, gana la de mayor porcentaje.
    if (!best[ref.cardId] || p.percent > best[ref.cardId].percent) best[ref.cardId] = { percent: p.percent, plan: ref.plan };
  }
  return cleanCards(Object.fromEntries(Object.entries(best).map(([id, b]) => [id, { plan: b.plan }])));
}
