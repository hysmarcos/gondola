// Cuánto se paga de verdad por un carrito de Coto: promos de Coto + reintegro del banco.
import { finalPrice, takeQty, isOnSale } from "./unit-price.js";

const round2 = (n) => Math.round(n * 100) / 100;

function analyzeLine({ id, name, qty, list, data }, store) {
  const price = data ? finalPrice(data, store) : null;
  if (!price || !(qty > 0)) {
    return { id, name, total: qty * list, onSale: false, missing: 0, saving: 0, promoText: null };
  }
  const take = takeQty(data, store);
  const onSale = isOnSale(data);
  if (take <= 1) {
    return { id, name, total: qty * price, onSale, missing: 0, saving: 0, promoText: null };
  }
  const full = Math.floor(qty / take) * take;
  const rest = qty - full;
  const promo = (data.discounts ?? []).find((d) => /Llevando/i.test(d.takingText ?? ""));
  return {
    id,
    name,
    total: full * price + rest * list,
    onSale,
    missing: rest ? take - rest : 0,
    saving: round2(take * (list - price)),
    promoText: promo?.discountText ?? null,
  };
}

function refundFor(promo, lines) {
  const eligible = lines.reduce((s, l) => s + (promo.onlyNoOffer && l.onSale ? 0 : l.total), 0);
  return round2(Math.min((eligible * promo.percent) / 100, promo.cap ?? Infinity));
}

function bestForDay(promos, day, lines) {
  let best = null;
  for (const p of promos) {
    if (!p.days.includes(day)) continue;
    const refund = refundFor(p, lines);
    if (!best || refund > best.refund) best = { promo: p, refund };
  }
  return best;
}

// lines: [{ id, name, qty, list, data }]; promos: las elegidas; day: 0 = domingo.
export function analyzeCart(lines, promos, day, store) {
  const analyzed = lines.map((l) => analyzeLine(l, store));
  const total = round2(analyzed.reduce((s, l) => s + l.total, 0));
  const listTotal = round2(lines.reduce((s, l) => s + l.qty * l.list, 0));

  const todayBest = bestForDay(promos, day, analyzed);
  const today = todayBest ? { ...todayBest, total: round2(total - todayBest.refund) } : null;

  let best = null;
  for (let k = 0; k < 7; k++) {
    const d = (day + k) % 7;
    const b = bestForDay(promos, d, analyzed);
    if (b && (!best || b.refund > best.refund)) best = { day: d, ...b, total: round2(total - b.refund) };
  }

  const used = [today?.promo, best?.promo].filter((p) => p?.capWeekly);
  return {
    lines: analyzed.map(({ id, name, missing, saving, promoText }) => ({ id, name, missing, saving, promoText })),
    total,
    listTotal,
    today,
    best,
    weeklyCapBanks: [...new Set(used.map((p) => p.bank))],
  };
}
