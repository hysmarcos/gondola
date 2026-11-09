// Cuánto se paga de verdad por un carrito de Coto: promos de Coto + reintegro del banco.
import { finalPrice, takeQty, bankBlock } from "./unit-price.js";
import { compareFields } from "./compare.js";

const round2 = (n) => Math.round(n * 100) / 100;

function analyzeLine({ id, name, qty, list, data }, store, opts = {}) {
  return { ...analyzeCore({ id, name, qty, list, data }, store, opts), ...compareFields(data, store, opts) };
}

function analyzeCore({ id, name, qty, list, data }, store, opts = {}) {
  const price = data ? finalPrice(data, store, opts) : null;
  if (!price || !(qty > 0)) {
    return { id, name, total: qty * list, listTotal: qty * list, bankEligible: !(data && bankBlock(data)), missing: 0, saving: 0, promoText: null };
  }
  const take = takeQty(data, store, opts);
  const bankEligible = !bankBlock(data);
  const listTotal = qty * list;
  if (take <= 1) {
    return { id, name, total: qty * price, listTotal, bankEligible, missing: 0, saving: 0, promoText: null };
  }
  const full = Math.floor(qty / take) * take;
  const rest = qty - full;
  const promo = (data.discounts ?? []).find((d) => /Llevando/i.test(d.takingText ?? ""));
  return {
    id,
    name,
    total: full * price + rest * list,
    listTotal,
    bankEligible,
    missing: rest ? take - rest : 0,
    saving: round2(take * (list - price)),
    promoText: promo?.discountText ?? null,
  };
}

function refundFor(promo, lines) {
  // Las promos bancarias no acumulan con ofertas y excluyen ciertos productos.
  const eligible = lines.reduce((s, l) => s + (l.bankEligible ? l.total : 0), 0);
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
export function analyzeCart(lines, promos, day, store, opts = {}) {
  const analyzed = lines.map((l) => analyzeLine(l, store, opts));
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
    lines: analyzed.map(({ id, name, total, listTotal, missing, saving, promoText, ean, cmp }) => ({
      id, name, total: round2(total), listTotal: round2(listTotal), missing, saving, promoText, ean, cmp,
    })),
    total,
    listTotal,
    today,
    best,
    weeklyCapBanks: [...new Set(used.map((p) => p.bank))],
  };
}
