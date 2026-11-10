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

// result: Nutrition o "missing". Devuelve el nodo raíz del bloque.
export function renderNutrition(doc, result, { ean, liquid }) {
  if (result === "missing") {
    const p = el(doc, "p", `${ROOT} ${ROOT}-missing`);
    p.dataset.ean = ean;
    p.append("Sin información nutricional. ", link(doc, offProductUrl(ean), "Podés cargarla en Open Food Facts"));
    return p;
  }
  const base = liquid ? "100 ml" : "100 g";
  const details = el(doc, "details", ROOT);
  details.dataset.ean = ean;
  const kcal = result.per100.kcal;
  details.append(el(doc, "summary", null, kcal === undefined ? "Información nutricional" : `Información nutricional · ${Math.round(kcal)} kcal cada ${base}`));
  details.append(table(doc, result, base));
  const foot = el(doc, "p", `${ROOT}-source`, "Fuente: Open Food Facts, datos cargados por la comunidad. ");
  foot.append(link(doc, result.url, "Ver ficha"));
  details.append(foot);
  return details;
}

// request(ean) → Promise<Nutrition | "missing" | "error">. onUpdate(): pedir un repintado.
export function createNutritionUi(doc, { request, onUpdate }) {
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

  // Dibuja o borra el bloque según la etiqueta de este momento: una respuesta vieja
  // nunca se dibuja sobre otro producto.
  function paint(container, anchor, label, enabled) {
    const current = container.querySelector(`.${ROOT}`);
    const ean = enabled && label?.nutri && label.ean ? String(label.ean) : null;
    if (current && current.dataset.ean !== ean) current.remove();
    if (!ean) return;
    if (!results.has(ean)) return ask(ean);
    const r = results.get(ean);
    if (r === "error") return container.querySelector(`.${ROOT}`)?.remove();
    if (container.querySelector(`.${ROOT}`)) return;
    // Bebida: cada 100 ml, salvo que Coto la venda por peso (polvos para preparar).
    const liquid = label.group === "L" || (label.drink === true && label.group !== "kg");
    const node = renderNutrition(doc, r, { ean, liquid });
    if (anchor && anchor.parentElement === container) anchor.after(node);
    else container.append(node);
  }

  return { paint };
}
