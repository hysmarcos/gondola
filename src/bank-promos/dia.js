// Promos de banco de Día: las tarjetas vienen como JSON incrustado en el HTML.
const DAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const money = (s) => Number(String(s).replace(/\./g, ""));

// Lee el array JSON que empieza en `start` (un "["), contando corchetes y respetando comillas.
function readArray(html, start) {
  let depth = 0;
  let inStr = false;
  for (let i = start; i < html.length; i++) {
    const c = html[i];
    if (inStr) {
      if (c === "\\") i++;
      else if (c === '"') inStr = false;
    } else if (c === '"') inStr = true;
    else if (c === "[") depth++;
    else if (c === "]" && --depth === 0) return html.slice(start, i + 1);
  }
  return null;
}

export function diaCards(html) {
  let best = [];
  const key = '"cards":[';
  let at = String(html || "").indexOf(key);
  while (at >= 0) {
    const raw = readArray(html, at + key.length - 1);
    if (raw) {
      try {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr) && arr.some((c) => c && c.terms != null) && arr.length > best.length) best = arr;
      } catch {
        // un bloque que no es JSON válido no nos sirve
      }
    }
    at = html.indexOf(key, at + 1);
  }
  return best;
}

function percentOf(title, terms) {
  const t = title.match(/(\d{1,2})\s*%/);
  if (t) return Number(t[1]);
  const re = /(\d{1,2})\s*%\s*(?:\([^)]*\)\s*)?DE\s+(?:REINTEGRO|DESCUENTO|AHORRO)/gi;
  const found = new Set([...terms.matchAll(re)].map((m) => Number(m[1])));
  return found.size === 1 ? [...found][0] : null;
}

// "compras mayores o iguales a $X" y variantes
const MIN_WORDS = /COMPRAS\s+(?:MAYORES|IGUALES|SUPERIORES)\s+O\s+(?:IGUALES|MAYORES|SUPERIORES)\s+A\s+\$\s*([\d.]+)/i;

// Devuelve { cap, capKnown, at } (at = dónde empieza el texto del tope, para ubicar el período).
// capKnown false = no se encontró ni tope ni "sin tope".
// Orden: tope del plan -> "sin tope" explícito -> primer tope genérico -> límite de descuento.
function capOf(terms, percent) {
  if (percent != null) {
    const own = terms.match(new RegExp(String.raw`\b${percent}\s*%\s*DE\s+DESCUENTO\s+CON\s+TOPE\s+DE\s+\$\s*(\d{1,3}(?:\.\d{3})+|\d+)`, "i"));
    if (own) return { cap: money(own[1]), capKnown: true, at: own.index };
  }
  if (/SIN\s+(?:TOPE|L[IÍ]MITE)/i.test(terms)) return { cap: null, capKnown: true, at: -1 };
  const m = terms.match(/TOPE[^$]{0,80}\$\s*(\d{1,3}(?:\.\d{3})+|\d+)/i)
    || terms.match(/L[IÍ]MITE DE DESCUENTO[^$]{0,60}\$\s*(\d{1,3}(?:\.\d{3})+|\d+)/i);
  return m ? { cap: money(m[1]), capKnown: true, at: m.index } : { cap: null, capKnown: false, at: -1 };
}

// El período más cercano al tope: el de menor índice dentro de 120 caracteres.
function capPeriodOf(terms, at) {
  if (at < 0) return null;
  const w = terms.slice(at, at + 120);
  const found = [["week", /SEMANA/i], ["month", /\bMES\b|MENSUAL/i], ["tx", /TRANSACCI/i]]
    .map(([p, re]) => [p, w.search(re)])
    .filter(([, i]) => i >= 0)
    .sort((x, y) => x[1] - y[1]);
  return found.length ? found[0][0] : null;
}

export function parseDia(html) {
  const out = [];
  for (const c of diaCards(html)) {
    if (!c || c.active === false || c.active == null) continue;
    const title = String(c.__editorItemTitle || "").trim();
    const terms = String(c.terms || "");
    const percent = percentOf(title, terms);
    const { cap, capKnown, at } = capOf(terms, percent);
    const min = terms.match(/M[IÍ]NIM[OA] DE COMPRA[^$]{0,30}\$\s*([\d.]+)/i) || terms.match(/PAGO M[IÍ]NIMO DE \$\s*([\d.]+)/i) || terms.match(MIN_WORDS);
    const days = c.daysToShow || {};
    const bank = (c.associatedBanks || [])[0];
    out.push({
      id: title,
      store: "dia",
      bankLabel: (bank && String(bank.__editorItemTitle || "").trim()) || title,
      title,
      percent,
      cap,
      capKnown,
      capPeriod: cap == null ? null : capPeriodOf(terms, at),
      minPurchase: min ? money(min[1]) : null,
      days: DAYS.flatMap((d, i) => (days[d] ? [i] : [])),
      from: null,
      to: null,
      online: !!c.availableOn && c.availableOn.online === true,
      direct: false,
      legal: terms,
    });
  }
  return out;
}
