// Promos bancarias de Coto (getPromocionesMulticanal) llevadas a datos simples.

const BANK_NAMES = {
  icbc: "ICBC", credicoop: "Credicoop", ciudad: "Ciudad", comafi: "Comafi",
  naranjax: "Naranja X", comunidad: "Comunidad Coto", columbia: "Columbia",
  tci: "TCI", patagonia: "Patagonia", supervielle: "Supervielle", galicia: "Galicia",
  nacion: "Nación", macro: "Macro", santander: "Santander", bbva: "BBVA", hsbc: "HSBC",
};

const DAYS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

export function dayName(day) {
  return DAYS[day] ?? "";
}

// "logo_naranjax2.png" → "naranjax".
export function bankKey(icono) {
  return String(icono ?? "")
    .replace(/^logo_/, "")
    .replace(/\.\w+$/, "")
    .replace(/[_\d]+$/, "")
    .replace(/_d$/, "")
    .toLowerCase();
}

function bankName(icono) {
  const key = bankKey(icono);
  return BANK_NAMES[key] ?? key.toUpperCase();
}

// La promo de Comunidad Coto viene en la lista de los bancos, pero no es de una tarjeta:
// es un descuento en la caja para los socios. Se activa con el ajuste "Tengo Comunidad Coto".
export function isComunidad(p) {
  return /comunidad/i.test(String(p?.logo ?? "")) || p?.bank === BANK_NAMES.comunidad;
}

// Primer monto "$ 20.000" del texto, o null si no tiene tope.
function parseCap(text) {
  if (/sin\s+(tope|l[ií]mite)/i.test(text) || !/tope/i.test(text)) return null;
  const m = text.match(/\$\s*(\d{1,3}(?:\.\d{3})+|\d+)/);
  return m ? Number(m[1].replace(/\./g, "")) : null;
}

export function parsePromos(result) {
  const list = result?.promocionesDigitales;
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const p of list) {
    const pct = String(p?.textoDescuento ?? "").match(/(\d+)\s*%\s*DE DESCUENTO/i);
    const days = (p?.dias ?? []).map((d) => Number(d?.id) - 1).filter((d) => d >= 0 && d <= 6);
    if (!pct || !days.length) continue;
    const obs = String(p.observacion ?? "");
    out.push({
      id: String(p.id),
      bank: bankName(p.icono),
      logo: p.icono ?? null,
      days,
      percent: Number(pct[1]),
      cap: parseCap(obs),
      capWeekly: /semana/i.test(obs),
      onlyNoOffer: /sin oferta/i.test(obs),
      text: String(p.descripcion ?? ""),
      obs,
    });
  }
  return out;
}

// La promo con mayor porcentaje que vale ese día para ese producto.
export function bestPromo(promos, day, onSale) {
  let best = null;
  for (const p of promos ?? []) {
    if (!p.days.includes(day)) continue;
    if (p.onlyNoOffer && onSale) continue;
    if (!best || p.percent > best.percent) best = p;
  }
  return best;
}
