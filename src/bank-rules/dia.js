// Reglas a mano de las promos online de Día. Fuente: los términos de cada tarjeta en
// la página de promos de Día, leídos el 2026-11-12.
// Lo que queda afuera a propósito (no se resta):
// - "Mercado Pago 10%": vale solo en "productos o servicios seleccionados" por Mercado Pago;
//   no se sabe cuáles, así que esa huella no está y queda "changed".
// - "Columbia 20% de reintegro": el legal dice "en las sucursales" y nunca nombra la tienda
//   online. No es una promo online: cardOf no la asigna.
// - "Banco del Sol": "no aplica sobre productos incluidos en programas gubernamentales"; con
//   los datos de Coto no se sabe cuáles son, así que esa huella no está y queda "changed".
// - "3CSI TC": cuotas con cualquier Visa, Mastercard, Amex o Cabal; no es una tarjeta de la lista.
import { hashOf } from "./hash.js";
import { norm } from "../exclusions.js";

const SOURCE = "https://diaonline.supermercadosdia.com.ar/medios-de-pago-y-promociones (2026-11-12)";

const plain = (s) => norm(s).trim();

// Plan de Naranja X: por el título o, si no, por el porcentaje en "PLAN TURBO: 25%".
// Con porcentaje y sin un único plan, no se adivina.
function naranja(promo) {
  const title = plain(promo.title);
  const named = ["inicial", "turbo", "epico"].find((p) => title.includes(p));
  if (named) return { cardId: "naranjax", plan: named };
  if (promo.percent == null) return { cardId: "naranjax", plan: null };
  const legal = plain(promo.legal);
  const found = ["inicial", "turbo", "epico"].filter((p) => new RegExp(`plan ${p}\\s*:\\s*${promo.percent}\\s*%`).test(legal));
  return found.length === 1 ? { cardId: "naranjax", plan: found[0] } : null;
}

export function cardOf(promo) {
  const bank = plain(promo?.bankLabel);
  const legal = plain(promo?.legal);
  // Solo en sucursales: no es promo online, aunque Día la marque así.
  if (/sucursal/.test(legal) && !/online|sitio web/.test(legal)) return null;
  if (bank === "personal pay") return { cardId: "personalpay", plan: null };
  if (bank === "modo") return { cardId: "modo", plan: null };
  if (bank === "mercado pago") return { cardId: "mercadopago", plan: null };
  if (bank === "banco columbia") return { cardId: "columbia", plan: null };
  if (bank === "banco del sol") return { cardId: "bancodelsol", plan: null };
  if (bank === "naranja") return naranja(promo);
  if (bank === "bna") return { cardId: "nacion", plan: null };
  return null;
}

export const exclusions = [
  // Sin oraciones de exclusión: "Personal Pay" y "20% - MODO". Ninguno excluye productos.
  { hash: hashOf(""), source: SOURCE, test: () => false },
  // "Naranja 20/25/30%": "no aplica para compras realizadas con Naranja Visa, Mastercard, Amex
  // ni billeteras que no sean Naranja X". Restringe el medio de pago, no productos.
  { hash: "4fd1ef42", source: SOURCE, test: () => false },
];
