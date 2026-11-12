// Huella de las exclusiones de una promo. Si el súper cambia ese texto, cambia la huella
// y la promo deja de restarse hasta que alguien relea los términos (alarma).

// Toda forma de restringir productos, aunque sea con otras palabras ("seleccionados",
// "no cumulativo"). Ninguna toca "EXCLUSIVO": esas oraciones hablan de vigencia, no de productos.
const KEYS = /EXCLUI|EXCLUY|EXCLUSION|EXCLUID|NO INCLUYE|NO APLICA|NO ACUMULA|NO CUMULATIV|NO VALID|NO PARTICIP|SELECCIONAD/;
const DATES = /\b(LUNES|MARTES|MIERCOLES|JUEVES|VIERNES|SABADOS?|DOMINGOS?|ENERO|FEBRERO|MARZO|ABRIL|MAYO|JUNIO|JULIO|AGOSTO|SE?PTIEMBRE|OCTUBRE|NOVIEMBRE|DICIEMBRE)\b/g;

const clean = (s) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toUpperCase().replace(/[^A-Z ]+/g, " ").replace(DATES, " ").replace(/ +/g, " ").trim();

// Solo las oraciones que hablan de exclusiones, sin números, días ni meses: un cambio de
// fecha o de tope no dispara la alarma. Un título como "EXCLUIDOS - NO INCLUYE:" trae la lista después,
// en oraciones sin esas palabras: desde ahí entra todo el resto del legal.
export function exclusionText(legal) {
  const out = [];
  let rest = false;
  for (const raw of String(legal ?? "").split(/\.(?=\s|$)|\r?\n/)) {
    const s = clean(raw);
    if (!s) continue;
    if (rest || KEYS.test(s)) out.push(s);
    if (KEYS.test(s) && raw.trim().endsWith(":")) rest = true;
  }
  return out.join("|");
}

// Huella de una promo: la de sus oraciones de exclusión o, si no tiene ninguna, la del legal
// entero (con la misma limpieza). Así un legal que nadie leyó nunca da una huella conocida
// por casualidad: "EXCEPTO…" o "ÚNICAMENTE EN…" no están en la lista de palabras.
export function fingerprint(legal) {
  return hashOf(exclusionText(legal) || clean(String(legal ?? "")));
}

// FNV-1a de 32 bits, en hexadecimal de 8 caracteres.
export function hashOf(text) {
  let h = 0x811c9dc5;
  for (const ch of String(text)) {
    h ^= ch.codePointAt(0);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}
