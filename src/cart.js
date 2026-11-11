// Cuánto se paga de verdad por un carrito de Coto: promos de Coto + reintegro del banco.
import { finalPrice, takeQty, bankBlock, offerText, unitPrice } from "./unit-price.js";
import { nutriEligible } from "./nutrition.js";
import { compareFields } from "./compare.js";

const round2 = (n) => Math.round(n * 100) / 100;

function analyzeLine({ id, name, qty, list, data, url }, store, opts = {}) {
  const core = { ...analyzeCore({ id, name, qty, list, data }, store, opts), url: url ?? data?.url ?? null };
  // Cuánto le saca Coto a esta línea y con qué promo (para el detalle del carrito).
  const discount = Math.max(0, round2(core.listTotal - core.total));
  const promoLabel = discount > 0.5 && data ? offerText(data, opts) : null;
  // Para la información nutricional de la compra: si es comida y el tamaño del envase.
  const nutri = data ? nutriEligible(data) : false;
  const amount = nutri ? unitPrice(data, store, [], 0, opts).amount ?? null : null;
  return { ...core, qty, nutri, amount, discount: discount > 0.5 ? discount : 0, promoLabel, ...compareFields(data, store, opts) };
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
  // En un NxM ("3x2") Coto regala unidades enteras. Su precio por unidad viene redondeado,
  // así que se cuenta por unidades pagas para llegar al mismo total que la caja.
  const nxm = String(promo?.discountText ?? "").trim().match(/^(\d+)\s*x\s*(\d+)$/i);
  const paid = nxm && Number(nxm[1]) === take && Number(nxm[2]) < take ? (full / take) * Number(nxm[2]) * list : full * price;
  return {
    id,
    name,
    total: paid + rest * list,
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
  // Reintegro de hoy: sobre qué monto aplica, el tope y si ya se llegó.
  const eligible = round2(analyzed.reduce((s, l) => s + (l.bankEligible ? l.total : 0), 0));
  const today = todayBest
    ? (() => {
        const cap = todayBest.promo.cap ?? null;
        const raw = (eligible * todayBest.promo.percent) / 100;
        return {
          ...todayBest,
          total: round2(total - todayBest.refund),
          eligible,
          cap,
          capReached: cap != null && raw >= cap - 0.005,
          capLeft: cap != null ? round2(Math.max(0, cap - todayBest.refund)) : null,
        };
      })()
    : null;
  // Parte del reintegro que le toca a cada línea (proporcional a lo que paga).
  const shareOf = (l) => (today && l.bankEligible && eligible > 0 ? round2((today.refund * l.total) / eligible) : 0);

  let best = null;
  for (let k = 0; k < 7; k++) {
    const d = (day + k) % 7;
    const b = bestForDay(promos, d, analyzed);
    if (b && (!best || b.refund > best.refund)) best = { day: d, ...b, total: round2(total - b.refund) };
  }

  const used = [today?.promo, best?.promo].filter((p) => p?.capWeekly);
  return {
    lines: analyzed.map((l) => {
      const { id, name, url, total, listTotal, missing, saving, promoText, ean, cmp, discount, promoLabel, qty, nutri, amount } = l;
      return {
        id, name, url, total: round2(total), listTotal: round2(listTotal), missing, saving, promoText, ean, cmp, qty, nutri, amount,
        discount, promoLabel, bankShare: shareOf(l),
      };
    }),
    discountTotal: round2(analyzed.reduce((s, l) => s + l.discount, 0)),
    total,
    listTotal,
    today,
    best,
    weeklyCapBanks: [...new Set(used.map((p) => p.bank))],
  };
}
