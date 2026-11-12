// Qué tarjeta y qué plan pide una promo de Coto (ya parseada por banks.js).
import { bankKey } from "../banks.js";

export function cardOf(promo) {
  const cardId = bankKey(promo?.logo);
  if (!cardId) return null;
  const text = `${promo.text ?? ""} ${promo.obs ?? ""}`;
  let plan = null;
  if (/plan sueldo/i.test(text)) plan = "sueldo";
  else if (/identit[eé]/i.test(text)) plan = "identite";
  else if (cardId === "naranjax") {
    if (/[eé]pico/i.test(text)) plan = "epico";
    else if (/turbo/i.test(text)) plan = "turbo";
    else if (/inicial/i.test(text)) plan = "inicial";
  }
  return { cardId, plan };
}
