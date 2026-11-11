// Bloque "Información nutricional" de la página de producto.
// Los datos llegan de Open Food Facts a través del service worker.
import { NUTRIENTS, offProductUrl } from "./nutrition.js";

const ROOT = "coto-unit-nutri";
const num = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 });

// kcal y mg sin decimales; gramos con hasta un decimal ("70,3 g").
function format(value, unit) {
  if (value === undefined) return "";
  return `${unit === "g" ? num.format(value) : Math.round(value)} ${unit}`;
}

function el(doc, tag, className, text) {
  const e = doc.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}

function link(doc, href, text) {
  const a = el(doc, "a", null, text);
  a.href = href;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  return a;
}

function table(doc, n, base) {
  const t = el(doc, "table", `${ROOT}-table`);
  const head = el(doc, "tr");
  head.append(el(doc, "th"), el(doc, "th", null, `cada ${base}`));
  if (n.perServing) head.append(el(doc, "th", null, n.servingSize ? `Por porción (${n.servingSize})` : "Por porción"));
  t.append(el(doc, "thead"));
  t.tHead.append(head);
  const body = el(doc, "tbody");
  for (const [key, , name, unit] of NUTRIENTS) {
    const a = n.per100[key];
    const b = n.perServing?.[key];
    if (a === undefined && b === undefined) continue;
    const tr = el(doc, "tr");
    tr.append(el(doc, "td", null, name), el(doc, "td", null, format(a, unit)));
    if (n.perServing) tr.append(el(doc, "td", null, format(b, unit)));
    body.append(tr);
  }
  t.append(body);
  return t;
}

function source(doc, url) {
  const foot = el(doc, "p", `${ROOT}-source`, "Fuente: Open Food Facts, datos cargados por la comunidad. ");
  foot.append(link(doc, url, "Ver ficha"));
  return foot;
}

function missingLine(doc, ean, className) {
  const p = el(doc, "p", className);
  p.append("Sin información nutricional. ", link(doc, offProductUrl(ean), "Podés cargarla en Open Food Facts"));
  return p;
}

function icon(doc, src, alt) {
  const img = el(doc, "img", `${ROOT}-icon`);
  img.src = src;
  img.alt = alt;
  img.width = 20;
  img.height = 20;
  return img;
}

// Bloque desplegable para la columna de compra (páginas sin "Descripción del producto").
// result: Nutrition o "missing". Devuelve el nodo raíz del bloque.
export function renderNutrition(doc, result, { ean, liquid }) {
  if (result === "missing") {
    const p = missingLine(doc, ean, `${ROOT} ${ROOT}-missing`);
    p.dataset.ean = ean;
    return p;
  }
  const base = liquid ? "100 ml" : "100 g";
  const details = el(doc, "details", ROOT);
  details.dataset.ean = ean;
  const kcal = result.per100.kcal;
  details.append(el(doc, "summary", null, kcal === undefined ? "Información nutricional" : `Información nutricional · ${Math.round(kcal)} kcal cada ${base}`));
  details.append(table(doc, result, base), source(doc, result.url));
  return details;
}

// Texto del resumen: kcal, azúcares y sodio, los que haya. null si no hay ninguno.
export function summaryText(n, liquid) {
  const p = n.per100;
  const parts = [];
  if (p.kcal !== undefined) parts.push(`${Math.round(p.kcal)} kcal`);
  if (p.sugars !== undefined) parts.push(`${format(p.sugars, "g")} azúcares`);
  if (p.sodiumMg !== undefined) parts.push(`${format(p.sodiumMg, "mg")} sodio`);
  return parts.length ? `${parts.join(" · ")} · cada ${liquid ? "100 ml" : "100 g"}` : null;
}

// Línea de resumen para la columna de compra. "Ver tabla" baja a la sección sin tocar la URL.
function renderSummary(doc, n, { ean, liquid, iconUrl }) {
  const text = summaryText(n, liquid);
  if (!text) return null;
  const p = el(doc, "p", `${ROOT}-sum`);
  p.dataset.ean = ean;
  if (iconUrl) p.append(icon(doc, iconUrl, ""));
  p.append(el(doc, "span", `${ROOT}-text`, text));
  const more = el(doc, "button", `${ROOT}-more`, "Ver tabla");
  more.type = "button";
  more.addEventListener("click", () => doc.querySelector(`.${ROOT}-section`)?.scrollIntoView({ behavior: "smooth", block: "start" }));
  p.append(more);
  return p;
}

// Sección "Información nutricional" junto a la descripción del producto.
function renderSection(doc, result, { ean, liquid, iconUrl }) {
  const sec = el(doc, "section", `${ROOT}-section`);
  sec.dataset.ean = ean;
  const h = el(doc, "h4", `${ROOT}-title`);
  if (iconUrl) h.append(icon(doc, iconUrl, "Open Food Facts"));
  h.append("Información nutricional");
  sec.append(h);
  if (result === "missing") sec.append(missingLine(doc, ean, `${ROOT}-missing`));
  else sec.append(table(doc, result, liquid ? "100 ml" : "100 g"), source(doc, result.url));
  return sec;
}

const HOST = "data-coto-unit-nutri-host";

// request(ean) → Promise<Nutrition | "missing" | "error">. onUpdate(): pedir un repintado.
// iconUrl: ícono de Open Food Facts (opcional).
export function createNutritionUi(doc, { request, onUpdate, iconUrl = null }) {
  const results = new Map(); // ean -> resultado
  const asked = new Set();

  function ask(ean) {
    if (asked.has(ean)) return;
    asked.add(ean);
    let p;
    try {
      p = Promise.resolve(request(ean));
    } catch {
      p = Promise.resolve("error");
    }
    p.catch(() => "error")
      .then((r) => {
        results.set(ean, r ?? "error");
        onUpdate();
      });
  }

  // Nodos de Góndola ya dibujados: en la columna y en la sección.
  const ours = (container, section) => [
    ...container.querySelectorAll(`:scope > .${ROOT}, :scope > .${ROOT}-sum`),
    ...(section ? section.host.querySelectorAll(`:scope > .${ROOT}-section`) : []),
  ];

  function place(node, parent, after) {
    if (after && after.parentElement === parent) after.after(node);
    else parent.append(node);
  }

  // Dibuja o borra según la etiqueta de este momento: una respuesta vieja nunca se dibuja
  // sobre otro producto. section: { host, after } (junto a la descripción) o null.
  function paint(container, anchor, label, enabled, section = null) {
    const ean = enabled && label?.nutri && label.ean ? String(label.ean) : null;
    const r = ean ? results.get(ean) : undefined;
    const keep = ean && r !== undefined && r !== "error";
    for (const node of ours(container, section)) {
      // Otro producto, o cambió el modo (con sección / desplegable): se borra.
      const wrongMode = section ? node.classList.contains(ROOT) : !node.classList.contains(ROOT);
      if (!keep || node.dataset.ean !== ean || wrongMode) node.remove();
    }
    if (section) {
      if (section.host.querySelector(`:scope > .${ROOT}-section`)) section.host.setAttribute(HOST, "");
      else section.host.removeAttribute(HOST);
    }
    if (!ean) return;
    if (r === undefined) return ask(ean);
    if (!keep) return;
    // Bebida: cada 100 ml, salvo que Coto la venda por peso (polvos para preparar).
    const liquid = label.group === "L" || (label.drink === true && label.group !== "kg");
    const opts = { ean, liquid, iconUrl };
    if (!section) {
      if (!container.querySelector(`:scope > .${ROOT}`)) place(renderNutrition(doc, r, opts), container, anchor);
      return;
    }
    if (!section.host.querySelector(`:scope > .${ROOT}-section`)) {
      place(renderSection(doc, r, opts), section.host, section.after);
      section.host.setAttribute(HOST, "");
    }
    if (r !== "missing" && !container.querySelector(`:scope > .${ROOT}-sum`)) {
      const sum = renderSummary(doc, r, opts);
      if (sum) place(sum, container, anchor);
    }
  }

  return { paint };
}
