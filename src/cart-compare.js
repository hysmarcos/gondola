// El carrito de Coto en otros súper: cuánto salen los mismos productos, sin banco y con
// las tarjetas del usuario, y dónde conviene comprar. Puro: todo llega por parámetro.
import { applies } from "./cards.js";
import { RULES, statusOf, excluded } from "./bank-rules/index.js";
import { STORES } from "./stores.js";
import { norm } from "./exclusions.js";

const round2 = (n) => Math.round(n * 100) / 100;
// Dato dudoso: el otro súper cobra menos de 0,4 o más de 2,5 veces lo que cobra Coto.
const MIN_RATIO = 0.4, MAX_RATIO = 2.5;
// Tolerancia de comparación.
const TOLERANCE = 0.01;

// Precio del otro súper para una línea, o null si falta o es dudoso (sale de los dos lados).
function otherLine(line, lines) {
  if (!line.ean || !line.cmp || !(line.total > 0)) return null;
  const r = lines?.[line.ean];
  if (!r || typeof r !== "object" || !Number.isFinite(r.total)) return null;
  const ratio = r.total / line.total;
  return ratio >= MIN_RATIO && ratio <= MAX_RATIO ? r : null;
}

// Un tope semanal o mensual también se usa como tope de esta compra: no se sabe cuánto
// gastó ya el usuario.
const savingOf = (eligible, promo) => round2(Math.min((eligible * promo.percent) / 100, promo.cap ?? Infinity));

function bankCotoOf(promo, pairs, coto) {
  if (!promo) return null;
  const eligible = pairs.reduce((s, p) => s + (p.line.bankEligible ? p.line.total : 0), 0);
  const saving = savingOf(eligible, promo);
  return { label: `${promo.bank} ${promo.percent}%`, saving, total: round2(coto - saving) };
}

// La mejor promo "ok" del día de compra para las tarjetas del usuario. Si no hay, por qué.
function bankOtherOf(promos, rules, cards, day, pairs, other) {
  if (promos === "error") return { bank: null, note: "error", minLeft: null };
  // Sin promos pedidas (el usuario no tiene tarjetas): no es un error.
  if (!Array.isArray(promos)) return { bank: null, note: "none", minLeft: null };
  const mine = promos.filter((p) => Array.isArray(p.days) && p.days.includes(day) && applies(cards, rules?.cardOf(p)));
  let best = null;
  let minLeft = null;
  for (const promo of mine) {
    if (!rules || statusOf(promo, rules) !== "ok") continue;
    if (promo.minPurchase != null && other < promo.minPurchase) {
      const left = round2(promo.minPurchase - other);
      if (minLeft === null || left < minLeft) minLeft = left;
      continue;
    }
    const eligible = pairs.reduce((s, { line, r }) => {
      const product = { name: norm(line.name), brand: norm(line.brand), groups: line.groups ?? [], onSale: !!r.onSale };
      return s + (excluded(promo, rules, product) ? 0 : r.total);
    }, 0);
    const saving = savingOf(eligible, promo);
    // Una promo que no ahorra nada (todo excluido) es como no tenerla.
    if (saving > 0 && (!best || saving > best.saving)) best = { label: `${promo.bankLabel} ${promo.percent}%`, saving, total: round2(other - saving) };
  }
  if (best) return { bank: best, note: null, minLeft: null };
  if (minLeft !== null) return { bank: null, note: "min", minLeft };
  if (rules && mine.some((p) => statusOf(p, rules) === "changed")) return { bank: null, note: "changed", minLeft: null };
  return { bank: null, note: "none", minLeft: null };
}

function storeCmp(store, { analysis, results, promos, cards, day, rules }) {
  const lines = (analysis?.lines ?? []).filter((l) => l.qty > 0);
  const base = { id: store.id, name: store.name };
  const res = results?.[store.id];
  if (!res || typeof res !== "object") return { ...base, state: "error" };

  const pairs = [];
  const missing = [];
  for (const line of lines) {
    const r = otherLine(line, res.lines);
    if (r) pairs.push({ line, r });
    else missing.push({ ean: line.ean ?? null, name: line.name });
  }
  const coto = round2(pairs.reduce((s, p) => s + p.line.total, 0));
  const other = round2(pairs.reduce((s, p) => s + p.r.total, 0));
  const out = {
    ...base,
    state: pairs.length ? "ok" : "empty",
    at: res.at,
    matched: pairs.length,
    of: lines.length,
    common: pairs.map(({ line, r }) => ({ ean: line.ean, name: line.name, coto: line.total, other: r.total, url: r.url ?? null })),
    missing,
    coto,
    other,
    diff: round2(other - coto),
    bankCoto: null,
    bankOther: null,
    bankNote: null,
    minLeft: null,
  };
  if (!pairs.length) return out;
  const bo = bankOtherOf(promos?.[store.id], rules?.[store.id], cards, day, pairs, other);
  return { ...out, bankCoto: bankCotoOf(analysis?.today?.promo, pairs, coto), bankOther: bo.bank, bankNote: bo.note, minLeft: bo.minLeft };
}

// Compiten los súper "ok" que tienen al menos la mitad del carrito de Coto en común.
function verdictOf(stores, analysis, cards) {
  const withCards = Object.keys(cards ?? {}).length > 0;
  const rivals = stores
    .filter((st) => st.state === "ok" && st.coto >= 0.5 * (analysis?.total ?? 0))
    .map((st) => {
      const totalCoto = withCards ? (st.bankCoto?.total ?? st.coto) : st.coto;
      const totalOther = withCards ? (st.bankOther?.total ?? st.other) : st.other;
      return { id: st.id, totalCoto, gain: round2(totalCoto - totalOther) };
    });
  if (!rivals.length) return { winner: null };
  const best = rivals.filter((r) => r.gain > TOLERANCE * r.totalCoto).sort((a, b) => b.gain - a.gain)[0];
  if (best) return { winner: best.id, saving: best.gain, withCards };
  // Gana Coto: por la menor diferencia a su favor (0 si empatan).
  return { winner: "coto", saving: Math.min(...rivals.map((r) => Math.max(0, -r.gain))), withCards };
}

// day: día de compra elegido (0 = domingo); puede no ser hoy.
export function compareCart({ analysis, results, promos, cards, day, stores = STORES, rules = RULES }) {
  const list = stores.map((store) => storeCmp(store, { analysis, results, promos, cards, day, rules }));
  return { stores: list, verdict: verdictOf(list, analysis, cards) };
}
