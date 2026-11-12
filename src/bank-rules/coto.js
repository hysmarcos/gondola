// Qué tarjeta y qué plan pide una promo de Coto (ya parseada por banks.js).
import { bankKey } from "../banks.js";
import { CARDS } from "../cards.js";

// En orden: el primero que nombra el texto y que la tarjeta tiene en CARDS.
const PLANS = [["sueldo", /plan sueldo/i], ["identite", /identit[eé]/i], ["epico", /[eé]pico/i], ["turbo", /turbo/i], ["inicial", /inicial/i]];

export function cardOf(promo) {
  const cardId = bankKey(promo?.logo);
  if (!cardId) return null;
  const text = `${promo.text ?? ""} ${promo.obs ?? ""}`;
  // Un plan que la tarjeta no tiene (o una tarjeta fuera de CARDS) queda en null: sirve con cualquiera.
  const plans = CARDS.find((c) => c.id === cardId)?.plans ?? [];
  const plan = PLANS.find(([id, re]) => plans.some((p) => p.id === id) && re.test(text))?.[0] ?? null;
  return { cardId, plan };
}
