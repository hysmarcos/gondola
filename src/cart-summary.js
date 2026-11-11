// Detalle de totales del carrito: Subtotal, descuentos de Coto (uno por promo activa),
// reintegro del banco con su tope, y total final. Lo usan el mini-carrito y /carrito.
// "Descuentos Coto" es una línea con su detalle cerrado: se abre al tocarla. En /carrito
// el detalle se abre debajo. En el mini-carrito se abre en un panel flotante, para que
// el desplegable no cambie de tamaño. El reintegro del banco y su tope se ven siempre.
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
    // El reintegro no se pliega: lo único que tiene debajo es el tope, y va siempre a la vista.
    rows.push({ kind: "bank", label: `${word} ${t.promo.bank} ${t.promo.percent}%`, sub: when, value: minus(t.refund), promo: t.promo });
    const weekly = t.promo.capWeekly ? " semanal" : "";
    if (t.cap == null) rows.push({ kind: "cap", state: "none", text: direct ? "Sin tope de descuento" : "Sin tope de reintegro" });
    else if (t.capReached) rows.push({ kind: "cap", state: "reached", text: `Llegaste al tope${weekly} de ${$0(t.cap)}` });
    else rows.push({ kind: "cap", state: "left", text: `Te quedan ${$0(t.capLeft)} de tope${weekly} (${$0(t.cap)})` });
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

// ---------- Panel flotante (mini-carrito) ----------
// Uno solo por página, pegado a la ventana: abrir el detalle no cambia el tamaño del
// desplegable de Coto, y el desplegable no lo corta.
const POP = "coto-unit-sum-pop";
const pops = new WeakMap(); // doc → { el, box, id }

function popOf(doc) {
  let pop = pops.get(doc);
  if (pop) return pop;
  const el = doc.createElement("div");
  el.className = POP;
  el.id = POP;
  el.setAttribute("role", "group");
  el.hidden = true;
  // Un clic adentro no llega a Coto: el mini-carrito no se cierra.
  el.addEventListener("click", (e) => e.stopPropagation());
  doc.body.append(el);
  pop = { el, box: null, id: null };
  pops.set(doc, pop);
  const win = doc.defaultView;
  doc.addEventListener("keydown", (e) => { if (e.key === "Escape") closeSummaryPop(doc); });
  // Clic fuera del panel y fuera de su botón: se cierra (el botón lo maneja la caja).
  doc.addEventListener("click", (e) => {
    if (!pop.box || el.contains(e.target)) return;
    const btn = e.target.closest?.(".coto-unit-sum-toggle");
    if (btn && pop.box.contains(btn)) return;
    closeSummaryPop(doc);
  }, true);
  win?.addEventListener("scroll", (e) => { if (!el.contains(e.target)) closeSummaryPop(doc); }, true);
  win?.addEventListener("resize", () => closeSummaryPop(doc));
  return pop;
}

export function closeSummaryPop(doc) {
  const pop = pops.get(doc);
  if (!pop?.box) return;
  const { box, id } = pop;
  pop.el.hidden = true;
  pop.box = null;
  pop.id = null;
  const now = openOf(box);
  now.delete(id);
  box.dataset.open = [...now].join(" ");
  box.querySelector(`.coto-unit-sum-toggle[data-group="${id}"]`)?.setAttribute("aria-expanded", "false");
}

// Arriba del botón si hay lugar; si no, abajo. Nunca más ancho ni más alto que la ventana.
function placePop(doc, pop, btn) {
  const win = doc.defaultView;
  const at = btn.getBoundingClientRect();
  const b = pop.box.getBoundingClientRect();
  const vw = doc.documentElement.clientWidth || win?.innerWidth || 0;
  const vh = win?.innerHeight || 0;
  const width = Math.min(b.width || 300, vw ? vw - 16 : 300);
  const above = at.top - 8;
  const below = vh - at.bottom - 8;
  const up = above >= 140 || above >= below;
  const s = pop.el.style;
  s.width = width + "px";
  s.left = Math.max(8, Math.min(b.left, vw - width - 8)) + "px";
  s.maxHeight = Math.max(96, Math.min(280, (up ? above : below) - 6)) + "px";
  s.top = up ? "auto" : at.bottom + 6 + "px";
  s.bottom = up ? vh - at.top + 6 + "px" : "auto";
}

function openPop(doc, box, btn) {
  closeSummaryPop(doc);
  const id = btn.dataset.group;
  const pop = popOf(doc);
  pop.box = box;
  pop.id = id;
  fillPop(doc, pop, btn);
  pop.el.hidden = false;
  placePop(doc, pop, btn);
  box.dataset.open = id;
  btn.setAttribute("aria-expanded", "true");
}

function fillPop(doc, pop, btn) {
  const { rows, logoUrl } = pop.box.__cotoSum;
  pop.el.setAttribute("aria-label", btn.querySelector(".coto-unit-sum-name")?.textContent ?? "Detalle");
  pop.el.replaceChildren(...rows.filter((r) => r.of === pop.id).map((r) => rowNode(doc, r, logoUrl)));
}

// Pinta (o actualiza) el detalle dentro de `box`. No toca el DOM si no cambió nada.
// opts.float: el detalle se abre en el panel flotante (mini-carrito).
// opts.alive(): false cuando el desplegable que tiene la caja ya no se ve.
export function paintSummary(doc, box, rows, logoUrl = () => null, opts = {}) {
  const float = !!opts.float;
  if (float && pops.get(doc)?.box === box && opts.alive && !opts.alive()) closeSummaryPop(doc);
  const sig = sigOf(rows) + (float ? "|float" : "");
  if (box.dataset.sum === sig) return;
  box.dataset.sum = sig;
  box.__cotoSum = { rows, logoUrl, float };
  const open = openOf(box);
  const withDetail = new Set(rows.map((r) => r.of).filter(Boolean));
  const nodes = [];
  for (const r of rows) {
    if (r.of && float) continue; // va en el panel
    const toggle = !!r.id && withDetail.has(r.id);
    const node = rowNode(doc, r, logoUrl, { toggle, open: open.has(r.id) });
    if (toggle && float) node.setAttribute("aria-controls", POP);
    if (r.of) {
      node.dataset.of = r.of;
      node.hidden = !open.has(r.of);
    }
    nodes.push(node);
  }
  box.replaceChildren(...nodes);
  if (float) {
    // Con el panel abierto, el carrito cambió: mismo panel con los datos nuevos.
    const pop = pops.get(doc);
    if (pop?.box === box) {
      const btn = box.querySelector(`.coto-unit-sum-toggle[data-group="${pop.id}"]`);
      if (btn) {
        fillPop(doc, pop, btn);
        placePop(doc, pop, btn);
      } else closeSummaryPop(doc);
    } else if (box.dataset.open) box.dataset.open = "";
  }
  if (box.dataset.toggles) return;
  box.dataset.toggles = "1";
  // Un solo listener por caja. El clic no sale de la caja: el desplegable de Coto no se entera.
  box.addEventListener("click", (e) => {
    const btn = e.target.closest?.(".coto-unit-sum-toggle");
    if (!btn || !box.contains(btn)) return;
    e.preventDefault();
    e.stopPropagation();
    if (box.__cotoSum?.float) {
      const pop = pops.get(doc);
      if (pop?.box === box && pop.id === btn.dataset.group) closeSummaryPop(doc);
      else openPop(doc, box, btn);
      return;
    }
    const now = openOf(box);
    const id = btn.dataset.group;
    if (now.has(id)) now.delete(id);
    else now.add(id);
    box.dataset.open = [...now].join(" ");
    btn.setAttribute("aria-expanded", String(now.has(id)));
    for (const d of box.querySelectorAll(`[data-of="${id}"]`)) d.hidden = !now.has(id);
  });
}
