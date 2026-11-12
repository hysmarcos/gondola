// Promos de banco de Más (Super Mas Online): filas de la API pública a Promo común.
const DAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

// "9.500" -> 9500
const money = (s) => Number(String(s).replace(/\./g, ""));

// "compras mayores o iguales a $X" y variantes
const MIN_WORDS = /compras\s+(?:mayores|iguales|superiores)\s+o\s+(?:iguales|mayores|superiores)\s+a\s+\$\s*([\d.]+)/i;

// capKnown false = no se encontró ni tope ni "sin tope".
function capOf(row) {
  const title = row.title || "";
  const sub = row.sub_title || "";
  if (/sin (?:tope|l[ií]mite)/i.test(title) || /sin (?:tope|l[ií]mite)/i.test(sub)) return { cap: null, capKnown: true };
  const m = sub.match(/tope[^$\d]{0,40}\$?\s*(\d{1,3}(?:\.\d{3})+|\d+)/i);
  return m ? { cap: money(m[1]), capKnown: true } : { cap: null, capKnown: false };
}

function capPeriodOf(sub) {
  if (/semanal/i.test(sub)) return "week";
  if (/mensual/i.test(sub)) return "month";
  if (/transacci/i.test(sub)) return "tx";
  return null;
}

export function parseMas(data) {
  if (!data || !Array.isArray(data.promos)) return [];
  const names = new Map((data.banks || []).map((b) => [b.id, b.name]));
  const out = [];
  for (const row of data.promos) {
    if (!row || !row.active) continue;
    const sub = row.sub_title || "";
    const min = sub.match(/m[ií]nimo de compra:?\s*\$\s*([\d.]+)/i) || sub.match(MIN_WORDS) || (row.legal || "").match(MIN_WORDS);
    const { cap, capKnown } = capOf(row);
    out.push({
      id: String(row.id),
      store: "mas",
      bankLabel: names.get(row.idBank) || "",
      title: row.title || "",
      percent: typeof row.discount_percentage === "number" ? row.discount_percentage : null,
      cap,
      capKnown,
      capPeriod: cap == null ? null : capPeriodOf(sub),
      minPurchase: min ? money(min[1]) : null,
      days: DAYS.flatMap((d, i) => (row[d] ? [i] : [])),
      from: row.active_from || null,
      to: row.active_to || null,
      online: row.ecommerce === true || row.ecommerce === "true",
      direct: /descuento/i.test(row.discount_text_info || ""),
      legal: row.legal || "",
    });
  }
  return out;
}
