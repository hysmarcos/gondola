// Detalle de totales del carrito: Subtotal, descuentos de Coto (uno por promo activa),
// reintegro del banco con su tope, y total final. Lo usan el mini-carrito y /carrito.
// Los descuentos se ven en una línea cada uno. El detalle de cada uno empieza cerrado
// y se abre al tocar la línea.
import { dayName, isComunidad } from "./banks.js";

const money0 = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });
const money2 = new Intl.NumberFormat("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const $0 = (n) => "$" + money0.format(n);
export const $2 = (n) => "$" + money2.format(n);
const minus = (n) => "−" + $2(n);

// a: análisis de cart.js. day: día de compra elegido; today: hoy (0 = domingo).
// hints: líneas extra para /carrito (mejor día).
export function summaryRows(a, day, today, { hints = false } = {}) {
  const rows = [{ kind: "subtotal", label: "Subtotal", value: $2(a.listTotal) }];

  const promos = a.lines.filter((l) => l.discount > 0);
  if (promos.length) {
    rows.push({ kind: "group", label: "Descuentos Coto", value: minus(a.discountTotal), id: "coto" });
    for (const l of promos) rows.push({ kind: "detail", label: l.name, tag: l.promoLabel, value: minus(l.discount), of: "coto" });
  }

  const t = a.today;
  const direct = t ? isComunidad(t.promo) : false;
  if (t) {
    const when = day === today ? "hoy" : dayName(day).toLowerCase();
    // Comunidad descuenta en la caja: no es un reintegro del banco.
    const word = direct ? "Descuento" : "Reintegro";
    // Llegar al tope cambia lo que se paga: ese aviso queda siempre a la vista.
    const fold = !(t.cap != null && t.capReached);
    rows.push({ kind: "bank", label: `${word} ${t.promo.bank} ${t.promo.percent}%`, sub: when, value: minus(t.refund), promo: t.promo, id: fold ? "bank" : undefined });
    const weekly = t.promo.capWeekly ? " semanal" : "";
    if (t.cap == null) rows.push({ kind: "cap", state: "none", text: direct ? "Sin tope de descuento" : "Sin tope de reintegro", of: "bank" });
    else if (t.capReached) rows.push({ kind: "cap", state: "reached", text: `Llegaste al tope${weekly} de ${$0(t.cap)}` });
    else rows.push({ kind: "cap", state: "left", text: `Te quedan ${$0(t.capLeft)} de tope${weekly} (${$0(t.cap)})`, of: "bank" });
  }

  rows.push({ kind: "total", label: t && !direct ? "Total final con reintegro" : "Total final", value: $2(t ? t.total : a.total) });

  if (hints && a.best && a.best.day !== day) {
    rows.push({ kind: "hint", text: `Mejor día: ${dayName(a.best.day).toLowerCase()} con ${a.best.promo.bank}, ${$2(a.best.total)}`, promo: a.best.promo });
  }
  return rows;
}

const sigOf = (rows) => rows.map((r) => [r.kind, r.label, r.tag, r.value, r.sub, r.state, r.text, r.promo?.logo, r.id, r.of].join("|")).join("\n");

// Qué detalles dejó abiertos la persona en cada caja. Se guarda en la caja misma.
const openOf = (box) => new Set((box.dataset.open ?? "").split(" ").filter(Boolean));

function span(doc, cls, text) {
  const el = doc.createElement("span");
  el.className = cls;
  el.textContent = text;
  return el;
}

function logoImg(doc, promo, logoUrl) {
  const src = promo ? logoUrl(promo.logo) : null;
  if (!src) return null;
  const img = doc.createElement("img");
  img.className = "coto-unit-logo";
  img.setAttribute("src", src);
  img.setAttribute("alt", promo.bank);
  return img;
}

// toggle: la línea abre y cierra su detalle (un botón). open: si está abierto.
function rowNode(doc, r, logoUrl, { toggle = false, open = false } = {}) {
  const row = doc.createElement(toggle ? "button" : "div");
  row.className = `coto-unit-sum-row coto-unit-sum-row--${r.kind}`;
  if (toggle) {
    row.type = "button";
    row.classList.add("coto-unit-sum-toggle");
    row.setAttribute("aria-expanded", String(open));
    row.dataset.group = r.id;
  }
  if (r.kind === "nutri" || r.kind === "nutri-note") {
    row.textContent = r.text;
    return row;
  }
  if (r.kind === "cap") {
    row.classList.add(`coto-unit-sum-cap--${r.state}`);
    row.textContent = r.text;
    return row;
  }
  if (r.kind === "hint") {
    const logo = logoImg(doc, r.promo, logoUrl);
    if (logo) row.append(logo);
    row.append(doc.createTextNode(r.text));
    return row;
  }
  const label = span(doc, "coto-unit-sum-label", "");
  const logo = r.kind === "bank" ? logoImg(doc, r.promo, logoUrl) : null;
  if (logo) label.append(logo);
  label.append(span(doc, "coto-unit-sum-name", r.label));
  if (r.tag) label.append(span(doc, "coto-unit-sum-tag", r.tag));
  if (r.sub) label.append(span(doc, "coto-unit-sum-sub", r.sub));
  row.append(label, span(doc, "coto-unit-sum-value", r.value));
  if (toggle) {
    const mark = span(doc, "coto-unit-sum-chevron", "");
    mark.setAttribute("aria-hidden", "true");
    row.append(mark);
  }
  return row;
}

// Pinta (o actualiza) el detalle dentro de `box`. No toca el DOM si no cambió nada.
export function paintSummary(doc, box, rows, logoUrl = () => null) {
  const sig = sigOf(rows);
  if (box.dataset.sum === sig) return;
  box.dataset.sum = sig;
  const open = openOf(box);
  const withDetail = new Set(rows.map((r) => r.of).filter(Boolean));
  box.replaceChildren(...rows.map((r) => {
    const node = rowNode(doc, r, logoUrl, { toggle: !!r.id && withDetail.has(r.id), open: open.has(r.id) });
    if (r.of) {
      node.dataset.of = r.of;
      node.hidden = !open.has(r.of);
    }
    return node;
  }));
  if (box.dataset.toggles) return;
  box.dataset.toggles = "1";
  // Un solo listener por caja. El clic no sale de la caja: el desplegable de Coto no se entera.
  box.addEventListener("click", (e) => {
    const btn = e.target.closest?.(".coto-unit-sum-toggle");
    if (!btn || !box.contains(btn)) return;
    e.preventDefault();
    e.stopPropagation();
    const now = openOf(box);
    const id = btn.dataset.group;
    if (now.has(id)) now.delete(id);
    else now.add(id);
    box.dataset.open = [...now].join(" ");
    btn.setAttribute("aria-expanded", String(now.has(id)));
    for (const d of box.querySelectorAll(`[data-of="${id}"]`)) d.hidden = !now.has(id);
  });
}
