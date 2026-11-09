// Promos por cantidad de Coto: NxM ("2x1", "3x2", "6x4") y "Llevando N".

const NXM = /^\s*(\d+)\s*x\s*(\d+)\s*$/i;

// { n, m } si el producto tiene una promo "lleva n, pagá m"; si no, null.
export function parseNxM(data) {
  for (const d of data?.discounts ?? []) {
    const hit = String(d?.discountText ?? "").match(NXM);
    if (!hit) continue;
    const n = Number(hit[1]);
    const m = Number(hit[2]);
    if (n > m && m >= 1) return { n, m };
  }
  return null;
}

// Cantidad a pedir: si al subir se completan las unidades pagas, suma las gratis.
// Bajar o borrar nunca se toca.
export function adjustQty(prev, next, nxm) {
  if (!nxm || !(next > prev) || next <= 0) return next;
  return next % nxm.n === nxm.m ? next + nxm.n - nxm.m : next;
}

function takeOf(data) {
  for (const d of data?.discounts ?? []) {
    const n = String(d?.takingText ?? "").match(/Llevando\s+(\d+)/i);
    if (n) return { take: Number(n[1]), text: String(d.discountText ?? "").trim() };
  }
  return null;
}

// Aviso breve al agregar. added: unidades gratis que sumamos nosotros.
export function promoNotice(data, qty, added = 0) {
  const nxm = parseNxM(data);
  const label = nxm ? `${nxm.n}x${nxm.m}` : null;
  if (nxm && added > 0) return `Promo ${label}: sumamos ${added} gratis`;
  if (nxm) return qty % nxm.n === 0 ? null : `Promo ${label}: llevando ${nxm.n} pagás ${nxm.m}`;
  const t = takeOf(data);
  if (!t || t.take < 2 || qty % t.take === 0) return null;
  return `Promo: ${t.text} llevando ${t.take}`;
}
