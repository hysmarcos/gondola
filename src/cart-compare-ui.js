// "Tu carrito en otros súper": el resultado de compareCart pintado en /carrito, y su
// resumen en una línea para el mini-carrito. Solo pinta: los pedidos viven en cart-ui.js.
import { $0 } from "./cart-summary.js";
import { STORES } from "./stores.js";

const CC = "coto-unit-cc";
// Tolerancia de comparación: dentro del 1% es "casi igual".
const TOLERANCE = 0.01;
const round2 = (n) => Math.round(n * 100) / 100;

const NOTES = {
  none: "Sin promo de tus tarjetas hoy",
  changed: "Los términos cambiaron: no se resta",
  error: "No pudimos leer las promos",
};

// Enlace al producto en el otro súper: solo https y del sitio de ese súper.
function storeHref(url, id) {
  const host = STORES.find((s) => s.id === id)?.host;
  if (!url || !host) return null;
  try {
    const u = new URL(String(url));
    return u.protocol === "https:" && u.hostname === host ? u.href : null;
  } catch {
    return null;
  }
}

// Contra quién se gana: Coto si gana otro súper; si gana Coto, el súper más cercano.
function runnerUp(cmp) {
  const v = cmp.verdict;
  if (v.winner !== "coto") return "Coto";
  const gap = (st) => {
    const coto = v.withCards ? st.bankCoto?.total ?? st.coto : st.coto;
    const other = v.withCards ? st.bankOther?.total ?? st.other : st.other;
    return Math.max(0, round2(other - coto));
  };
  return cmp.stores.find((st) => st.state === "ok" && Math.abs(gap(st) - v.saving) < 0.01)?.name ?? null;
}

function verdictView(cmp) {
  const v = cmp.verdict;
  if (!v || v.winner == null) return { text: "Pocos productos en común para comparar", sub: null };
  const name = v.winner === "coto" ? "Coto" : cmp.stores.find((st) => st.id === v.winner)?.name ?? v.winner;
  const text = `Hoy te conviene ${name}`;
  if (!(Math.round(v.saving) > 0)) return { text, sub: "Sale casi lo mismo en todos" };
  if (!v.withCards) return { text, sub: `Pagás ${$0(v.saving)} menos` };
  const second = runnerUp(cmp);
  return { text, sub: `Con tus tarjetas pagás ${$0(v.saving)} menos` + (second ? ` que en ${second}` : "") };
}

function deltaOf(st) {
  if (Math.abs(st.diff) <= TOLERANCE * st.coto) return { cls: "eq", text: "= casi igual" };
  return st.diff < 0 ? { cls: "down", text: `▼ ${$0(-st.diff)} menos` } : { cls: "up", text: `▲ ${$0(st.diff)} más` };
}

function storeView(st, cards) {
  if (st.state === "error") return { id: st.id, text: `No pudimos consultar ${st.name}` };
  if (st.state !== "ok") return { id: st.id, text: `${st.name}: ningún producto en común` };
  const rows = [{ label: "Sin banco", value: `${$0(st.other)} · Coto ${$0(st.coto)}` }];
  if (cards) {
    if (st.bankOther) {
      rows.push({ label: `Con tus tarjetas (${st.bankOther.label})`, value: `${$0(st.bankOther.total)} · Coto ${$0(st.bankCoto?.total ?? st.coto)}` });
    } else {
      const note = st.bankNote === "min" ? `Te faltan ${$0(st.minLeft)} para la compra mínima` : NOTES[st.bankNote] ?? NOTES.none;
      rows.push({ label: "Con tus tarjetas", value: note, note: true });
    }
  }
  const lists = [];
  if (st.missing.length) {
    lists.push({ id: `missing:${st.id}`, label: `Faltan ${st.missing.length}: ver cuáles`, items: st.missing.map((m) => ({ name: m.name })) });
  }
  if (st.common.length) {
    lists.push({
      id: `common:${st.id}`,
      label: `Ver los ${st.common.length} productos`,
      items: st.common.map((c) => ({ name: c.name, href: storeHref(c.url, st.id), link: `Ver en ${st.name}` })),
    });
  }
  return { id: st.id, head: `${st.name} · ${st.matched} de ${st.of} productos`, delta: deltaOf(st), rows, lists };
}

function footOf(cmp, now) {
  const ats = cmp.stores.map((st) => st.at).filter(Number.isFinite);
  if (!ats.length) return "Precios online, sin envío";
  const min = Math.floor((now - Math.min(...ats)) / 60_000);
  return `Precios online de ${min < 1 ? "recién" : `hace ${min} min`}, sin envío`;
}

function el(doc, tag, cls, text) {
  const e = doc.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

function storeNode(doc, s, open) {
  const node = el(doc, "div", `${CC}-store`);
  node.dataset.store = s.id;
  if (!s.head) {
    node.classList.add(`${CC}-store--off`);
    node.textContent = s.text;
    return node;
  }
  const head = el(doc, "div", `${CC}-head`);
  head.append(el(doc, "span", `${CC}-name`, s.head), el(doc, "span", `${CC}-delta ${CC}--${s.delta.cls}`, s.delta.text));
  node.append(head);
  for (const r of s.rows) {
    const row = el(doc, "div", `${CC}-row` + (r.note ? ` ${CC}-row--note` : ""));
    row.append(el(doc, "span", `${CC}-label`, r.label), el(doc, "span", `${CC}-value`, r.value));
    node.append(row);
  }
  for (const l of s.lists) {
    const btn = el(doc, "button", `${CC}-toggle`, l.label);
    btn.type = "button";
    btn.dataset.list = l.id;
    btn.setAttribute("aria-expanded", String(open.has(l.id)));
    const ul = el(doc, "ul", `${CC}-list`);
    ul.dataset.of = l.id;
    ul.hidden = !open.has(l.id);
    for (const it of l.items) {
      const li = el(doc, "li", null);
      li.append(el(doc, "span", `${CC}-item`, it.name));
      if (it.href) {
        const a = el(doc, "a", `${CC}-link`, it.link);
        a.setAttribute("href", it.href);
        a.setAttribute("target", "_blank");
        a.setAttribute("rel", "noopener");
        li.append(a);
      }
      ul.append(li);
    }
    node.append(btn, ul);
  }
  return node;
}

// Qué listas dejó abiertas la persona. Se guarda en la caja misma.
const openOf = (box) => new Set((box.dataset.open ?? "").split(" ").filter(Boolean));

// Pinta (o actualiza) el bloque dentro de `box`. No toca el DOM si no cambió nada.
// opts.now: ahora en ms. opts.onRefresh(): botón "Actualizar". opts.cards: el usuario
// tiene tarjetas prendidas (sin tarjetas no va el renglón "Con tus tarjetas").
export function paintCartCompare(doc, box, cmp, { now = Date.now(), onRefresh = null, cards = false } = {}) {
  box.__cotoCc = { onRefresh };
  const view = {
    verdict: verdictView(cmp),
    stores: cmp.stores.map((st) => storeView(st, cards)),
    foot: footOf(cmp, now),
  };
  const sig = JSON.stringify(view);
  if (box.dataset.sig === sig) return;
  box.dataset.sig = sig;
  const open = openOf(box);
  const top = el(doc, "div", `${CC}-verdict`);
  top.append(el(doc, "div", `${CC}-answer`, view.verdict.text));
  if (view.verdict.sub) top.append(el(doc, "div", `${CC}-sub`, view.verdict.sub));
  const foot = el(doc, "div", `${CC}-foot`);
  const refresh = el(doc, "button", `${CC}-refresh`, "Actualizar");
  refresh.type = "button";
  foot.append(el(doc, "span", null, view.foot), refresh);
  box.replaceChildren(el(doc, "div", `${CC}-title`, "Tu carrito en otros súper"), top, ...view.stores.map((s) => storeNode(doc, s, open)), foot);
  if (box.dataset.wired) return;
  box.dataset.wired = "1";
  // Un solo listener por caja.
  box.addEventListener("click", (e) => {
    if (e.target.closest?.(`.${CC}-refresh`)) {
      e.stopPropagation();
      return box.__cotoCc?.onRefresh?.();
    }
    const btn = e.target.closest?.(`.${CC}-toggle`);
    if (!btn || !box.contains(btn)) return;
    e.stopPropagation();
    const now = openOf(box);
    const id = btn.dataset.list;
    if (now.has(id)) now.delete(id);
    else now.add(id);
    box.dataset.open = [...now].join(" ");
    btn.setAttribute("aria-expanded", String(now.has(id)));
    const list = box.querySelector(`[data-of="${id}"]`);
    if (list) list.hidden = !now.has(id);
  });
}

// La respuesta de arriba en corto, para el mini-carrito. null si no hay respuesta.
export function miniCartLine(cmp) {
  const v = cmp?.verdict;
  if (!v || v.winner == null) return null;
  if (v.winner === "coto") return "Coto es el más barato";
  const st = cmp.stores.find((s) => s.id === v.winner);
  return st ? `${st.name}: ${$0(v.saving)} menos en ${st.matched} de ${st.of}` : null;
}

// La línea va como última fila de la caja de resumen del mini-carrito (paintSummary la
// rearma cuando cambia, por eso se vuelve a poner). Una sola línea: no cambia de alto.
export function paintMiniCompare(doc, box, text) {
  let row = box.querySelector(`:scope > .${CC}-mini`);
  if (!text) return row?.remove();
  if (!row) {
    row = el(doc, "a", `coto-unit-sum-row ${CC}-mini`);
    row.setAttribute("href", "/carrito");
  }
  if (row.textContent !== text) row.textContent = text;
  if (box.lastElementChild !== row) box.append(row);
}
