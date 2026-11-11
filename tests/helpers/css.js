// Lectura de los CSS de Góndola para las pruebas: selectores de cada regla y el selector
// "pelado" (sin el atributo de <html> ni estados) que se busca en las capturas de Coto.

// Parte una lista de selectores por las comas de afuera: las de :has(a, b) o :is(a, b)
// son parte de un mismo selector.
export function splitSelectors(head) {
  const out = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < head.length; i++) {
    const ch = head[i];
    if (ch === "(" || ch === "[") depth++;
    else if (ch === ")" || ch === "]") depth--;
    else if (ch === "," && depth === 0) {
      out.push(head.slice(start, i).trim());
      start = i + 1;
    }
  }
  out.push(head.slice(start).trim());
  return out.filter(Boolean);
}

const skipHead = (head) => !head || head.startsWith("@") || /^(from|to|\d+%)/.test(head);

// Reglas del CSS: sus selectores y los comentarios que van justo antes de la regla
// (entre la llave de cierre anterior y la de apertura). Las reglas dentro de un @media
// también cuentan; los @-bloques y los pasos de un @keyframes no.
export function rules(css) {
  const out = [];
  for (const m of css.matchAll(/([^{}]+)\{[^{}]*\}/g)) {
    const comments = m[1].match(/\/\*[\s\S]*?\*\//g) ?? [];
    const head = m[1].replace(/\/\*[\s\S]*?\*\//g, "").trim();
    if (skipHead(head)) continue;
    out.push({ selectors: splitSelectors(head), comments });
  }
  return out;
}

// Selectores de cada regla, sin comentarios ni el contenido de las llaves.
export function selectors(css) {
  return rules(css.replace(/\/\*[\s\S]*?\*\//g, "")).flatMap((r) => r.selectors);
}

// Estados que la captura no tiene: se sacan, con su :not(…) si lo hay.
const STATE = "(?:hover|active|focus|focus-visible|focus-within|checked|disabled|visited)";

// El selector sin los atributos de Góndola sobre <html> ([data-gondola-skin…],
// [data-gondola-theme…], en cualquier orden), sin pseudo-elementos y sin estados.
// "" si el selector era solo el prefijo (los tokens de color, sobre <html>).
export function bare(sel) {
  return sel
    .replace(/^(?:\[data-gondola-(?:skin|theme)[^\]]*\])+\s*/, "")
    .replace(/::[\w-]+/g, "")
    .replace(new RegExp(`:not\\(:${STATE}\\)`, "g"), "")
    .replace(new RegExp(`:${STATE}(?![\\w-])`, "g"), "")
    .trim();
}
