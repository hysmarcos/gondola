// Reglas de cada súper y el estado de una promo. Solo una promo "ok" se resta de un total.
import * as coto from "./coto.js";
import * as mas from "./mas.js";
import * as dia from "./dia.js";
import * as carrefour from "./carrefour.js";
import { fingerprint, hashOf } from "./hash.js";

export const RULES = { coto, mas, dia, carrefour };

// La huella vacía (legal vacío) no es un texto leído: nunca da una regla.
const EMPTY = hashOf("");

// Una huella por promo: excluded() se llama una vez por producto del carrito.
const prints = new WeakMap();
function printOf(promo) {
  if (!promo || typeof promo !== "object") return fingerprint(promo?.legal);
  if (!prints.has(promo)) prints.set(promo, fingerprint(promo.legal));
  return prints.get(promo);
}

const entryOf = (promo, rules) => {
  const hash = printOf(promo);
  if (hash === EMPTY) return null;
  return (rules?.exclusions ?? []).find((e) => e.hash === hash) ?? null;
};

// "unclear": sin porcentaje o sin tope leído (ni monto ni "sin tope").
export function statusOf(promo, rules) {
  if (!rules?.cardOf(promo)) return "unmapped";
  if (promo.percent == null || promo.capKnown === false) return "unclear";
  if (!entryOf(promo, rules)) return "changed";
  return "ok";
}

// Con términos que no conocemos, todo queda excluido.
export function excluded(promo, rules, product) {
  const entry = entryOf(promo, rules);
  return entry ? !!entry.test(product) : true;
}

// Lo que pide la pestaña Tarjetas por cada promo de un súper. "error" pasa igual.
export function promoEntries(storeId, promos) {
  if (!Array.isArray(promos)) return "error";
  const rules = RULES[storeId];
  return promos.map((promo) => ({ promo, ref: rules?.cardOf(promo) ?? null, status: rules ? statusOf(promo, rules) : "unmapped" }));
}
