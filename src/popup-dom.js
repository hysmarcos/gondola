// Piezas de DOM que comparten las pantallas del popup.
const SVG = "http://www.w3.org/2000/svg";

export function el(doc, tag, props = {}, children = []) {
  const e = doc.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === "attrs") for (const [a, val] of Object.entries(v)) e.setAttribute(a, val);
    else e[k] = v;
  }
  for (const c of children) if (c != null) e.append(c);
  return e;
}

export function icon(doc, paths) {
  const svg = doc.createElementNS(SVG, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("class", "icon");
  for (const d of paths) {
    const p = doc.createElementNS(SVG, "path");
    p.setAttribute("d", d);
    svg.append(p);
  }
  return svg;
}

export const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
export const norm = (t) => String(t).normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

export function switchInput(doc, props) {
  return el(doc, "input", { type: "checkbox", className: "switch", ...props, attrs: { role: "switch", ...(props.attrs ?? {}) } });
}
