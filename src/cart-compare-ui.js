// "Tu carrito en otros súper": el resultado de compareCart pintado en /carrito, y su
// resumen en una línea para el mini-carrito. Solo pinta: los pedidos viven en cart-ui.js.
import { $0 } from "./cart-summary.js";
import { STORES } from "./stores.js";
import { dayName } from "./banks.js";

const CC = "coto-unit-cc";
// Tolerancia de comparación: dentro del 1% es "casi igual".
const TOLERANCE = 0.01;

const NOTES = {
  none: "Sin promo de tus tarjetas",
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

const FEW = "Pocos productos en común para comparar";
const WAIT = "Comparando con otros súper…";

// Nombre para mostrar de un id del veredicto ("coto" o un súper).
const nameOf = (cmp, id) => (id === "coto" ? "Coto" : cmp.stores.find((st) => st.id === id)?.name ?? null);

// when: "hoy" o "el miércoles" (el día de compra elegido, si no es hoy).
function verdictView(cmp, when) {
  const v = cmp.verdict;
  if (!v || v.winner == null) return { text: FEW, sub: null };
  const who = nameOf(cmp, v.winner) ?? v.winner;
  const text = when === "hoy" ? `Hoy te conviene ${who}` : `${when[0].toUpperCase()}${when.slice(1)} te conviene ${who}`;
  if (!(Math.round(v.saving) > 0)) return { text, sub: "Sale casi lo mismo en todos" };
  if (!v.withCards) return { text, sub: `Pagás ${$0(v.saving)} menos` };
  const second = nameOf(cmp, v.runnerUp);
  return { text, sub: `Con tus tarjetas pagás ${$0(v.saving)} menos` + (second ? ` que en ${second}` : "") };
}

// Total de cada lado: con las tarjetas si se muestran, sin banco si no.
function finalOf(st, cards) {
  return { other: cards ? st.bankOther?.total ?? st.other : st.other, coto: cards ? st.bankCoto?.total ?? st.coto : st.coto };
}

// La diferencia de arriba es la de la última fila del desglose.
function deltaOf(st, cards) {
  const f = finalOf(st, cards);
  const diff = f.other - f.coto;
  if (Math.abs(diff) <= TOLERANCE * f.coto) return { cls: "eq", text: "Casi igual que en Coto" };
  return diff < 0 ? { cls: "down", text: `${$0(-diff)} menos que en Coto` } : { cls: "up", text: `${$0(diff)} más que en Coto` };
}

// Quién cobra menos esa línea: se resalta ese precio.
function cheaper(c) {
  if (Math.abs(c.other - c.coto) <= TOLERANCE * c.coto) return "eq";
  return c.other < c.coto ? "other" : "coto";
}

const bankCell = (b) => (b ? { text: `−${$0(b.saving)}`, sub: b.label } : { text: "—", sub: null });

function storeView(st, cards, when, logo) {
  if (st.state === "error") return { id: st.id, name: st.name, logo: logo(st.id), text: `No pudimos consultar ${st.name}` };
  if (st.state !== "ok") return { id: st.id, name: st.name, logo: logo(st.id), text: `${st.name}: ningún producto en común` };
  const final = finalOf(st, cards);
  // Desglose: subtotal, lo que restan las tarjetas de cada lado y el total.
  const totals = [{ label: "Subtotal", other: { text: $0(st.other) }, coto: { text: $0(st.coto) } }];
  let note = null;
  if (cards) {
    if (st.bankOther || st.bankCoto) {
      totals.push({ label: "Tus tarjetas", cls: "bank", other: bankCell(st.bankOther), coto: bankCell(st.bankCoto) });
      totals.push({ label: "Total", cls: "total", other: { text: $0(final.other) }, coto: { text: $0(final.coto) } });
    }
    if (!st.bankOther) {
      const why = st.bankNote === "min" ? `Te faltan ${$0(st.minLeft)} para la compra mínima`
        : st.bankNote !== "none" && NOTES[st.bankNote] ? NOTES[st.bankNote]
        : `${NOTES.none} ${when}`;
      note = why;
    }
  }
  return {
    id: st.id,
    name: st.name,
    logo: logo(st.id),
    cotoLogo: logo("coto"),
    count: `${st.matched} de ${st.of} productos`,
    delta: deltaOf(st, cards),
    common: st.common.length
      ? {
          id: `common:${st.id}`,
          n: st.common.length,
          items: st.common.map((c) => ({
            name: c.name,
            qty: c.qty > 1 ? `× ${c.qty}` : null,
            href: storeHref(c.url, st.id),
            was: c.otherList > c.other ? $0(c.otherList) : null,
            other: $0(c.other),
            coto: $0(c.coto),
            win: cheaper(c),
          })),
        }
      : null,
    totals,
    note,
    missing: st.missing.length
      ? { id: `missing:${st.id}`, label: `Faltan ${st.missing.length}: ver cuáles`, items: st.missing.map((m) => ({ name: m.name, href: storeHref(m.url, st.id) })) }
      : null,
  };
}

function footOf(cmp, now) {
  const ats = cmp.stores.map((st) => st.at).filter(Number.isFinite);
  if (!ats.length) return "Precios online, sin envío";
  const min = Math.floor((now - Math.min(...ats)) / 60_000);
  return min < 1 ? "Precios online recién consultados, sin envío" : `Precios online de hace ${min} min, sin envío`;
}

function el(doc, tag, cls, text) {
  const e = doc.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

// Logo de un súper. Decorativo: el nombre va escrito al lado.
function logoImg(doc, url, size) {
  const img = el(doc, "img", `${CC}-logo`);
  img.src = url;
  img.alt = "";
  img.width = size;
  img.height = size;
  return img;
}

// El nombre del producto es el enlace a su página en el otro súper.
function productName(doc, it) {
  const name = el(doc, it.href ? "a" : "span", `${CC}-item`, it.name);
  if (it.href) {
    name.setAttribute("href", it.href);
    name.setAttribute("target", "_blank");
    name.setAttribute("rel", "noopener");
  }
  return name;
}

// Las listas de productos en común empiezan abiertas; las de faltantes, cerradas. La caja
// guarda cuáles cambió la persona.
const isOpen = (touched, id) => id.startsWith("common:") !== touched.has(id);
const commonLabel = (n, open) => `${open ? "Ocultar" : "Ver"} ${Number(n) === 1 ? "el producto" : `los ${n} productos`}`;

function toggleBtn(doc, id, label, open) {
  const btn = el(doc, "button", `${CC}-toggle`, label);
  btn.type = "button";
  btn.dataset.list = id;
  btn.setAttribute("aria-expanded", String(open));
  return btn;
}

function colHead(doc, name, logo) {
  const th = el(doc, "th", `${CC}-col`);
  th.setAttribute("scope", "col");
  const inner = el(doc, "span", `${CC}-colname`);
  if (logo) inner.append(logoImg(doc, logo, 16));
  inner.append(el(doc, "span", null, name));
  th.append(inner);
  return th;
}

function moneyCell(doc, c) {
  const td = el(doc, "td", `${CC}-num`);
  td.append(el(doc, "span", `${CC}-amount`, c.text));
  if (c.sub) td.append(el(doc, "span", `${CC}-via`, c.sub));
  return td;
}

// Una tabla por súper: productos arriba, desglose abajo, con las mismas dos columnas.
function tableNode(doc, s, touched) {
  const table = el(doc, "table", `${CC}-table`);
  const head = el(doc, "tr", null);
  const first = el(doc, "th", `${CC}-col ${CC}-col--name`);
  first.setAttribute("scope", "col");
  if (s.common) {
    const open = isOpen(touched, s.common.id);
    const btn = toggleBtn(doc, s.common.id, commonLabel(s.common.n, open), open);
    btn.dataset.n = String(s.common.n);
    first.append(btn);
  }
  head.append(first, colHead(doc, s.name, s.logo), colHead(doc, "Coto", s.cotoLogo));
  const thead = el(doc, "thead", null);
  thead.append(head);
  table.append(thead);
  if (s.common) {
    const body = el(doc, "tbody", `${CC}-items`);
    body.dataset.of = s.common.id;
    body.hidden = !isOpen(touched, s.common.id);
    for (const it of s.common.items) {
      const tr = el(doc, "tr", null);
      const th = el(doc, "th", `${CC}-prod`);
      th.setAttribute("scope", "row");
      th.append(productName(doc, it));
      if (it.qty) th.append(el(doc, "span", `${CC}-qty`, it.qty));
      const other = el(doc, "td", `${CC}-num` + (it.win === "other" ? ` ${CC}-num--win` : ""));
      if (it.was) other.append(el(doc, "s", `${CC}-was`, it.was));
      other.append(el(doc, "span", `${CC}-amount`, it.other));
      const coto = el(doc, "td", `${CC}-num` + (it.win === "coto" ? ` ${CC}-num--win` : ""));
      coto.append(el(doc, "span", `${CC}-amount`, it.coto));
      tr.append(th, other, coto);
      body.append(tr);
    }
    table.append(body);
  }
  const foot = el(doc, "tfoot", null);
  for (const t of s.totals) {
    const tr = el(doc, "tr", `${CC}-sum` + (t.cls ? ` ${CC}-sum--${t.cls}` : ""));
    const th = el(doc, "th", null, t.label);
    th.setAttribute("scope", "row");
    tr.append(th, moneyCell(doc, t.other), moneyCell(doc, t.coto));
    foot.append(tr);
  }
  table.append(foot);
  return table;
}

function storeNode(doc, s, touched) {
  const node = el(doc, "section", `${CC}-store`);
  node.dataset.store = s.id;
  const head = el(doc, "div", `${CC}-head`);
  const who = el(doc, "div", `${CC}-who`);
  if (s.logo) who.append(logoImg(doc, s.logo, 28));
  const names = el(doc, "div", `${CC}-names`);
  names.append(el(doc, "span", `${CC}-name`, s.name));
  who.append(names);
  head.append(who);
  node.append(head);
  if (!s.totals) {
    node.classList.add(`${CC}-store--off`);
    node.append(el(doc, "p", `${CC}-off`, s.text));
    return node;
  }
  names.append(el(doc, "span", `${CC}-count`, s.count));
  head.append(el(doc, "span", `${CC}-delta ${CC}--${s.delta.cls}`, s.delta.text));
  node.append(tableNode(doc, s, touched));
  if (s.note) node.append(el(doc, "p", `${CC}-note`, s.note));
  if (s.missing) {
    const open = isOpen(touched, s.missing.id);
    const ul = el(doc, "ul", `${CC}-list`);
    ul.dataset.of = s.missing.id;
    ul.hidden = !open;
    for (const it of s.missing.items) {
      const li = el(doc, "li", null);
      li.append(productName(doc, it));
      ul.append(li);
    }
    const wrap = el(doc, "div", `${CC}-missing`);
    wrap.append(toggleBtn(doc, s.missing.id, s.missing.label, open), ul);
    node.append(wrap);
  }
  return node;
}

// Qué listas tocó la persona. Se guarda en la caja misma.
const openOf = (box) => new Set((box.dataset.open ?? "").split(" ").filter(Boolean));

// Pinta (o actualiza) el bloque dentro de `box`. No toca el DOM si no cambió nada.
// opts.now: ahora en ms. opts.onRefresh(): botón "Actualizar". opts.cards: el usuario
// tiene tarjetas prendidas (sin tarjetas no va el desglose con tarjetas). opts.day: el
// día de compra; opts.today: hoy (0 = domingo). Si no son el mismo, los textos dicen el día.
// opts.logo(id): URL del logo de un súper ("coto", "carrefour"…) o null.
export function paintCartCompare(doc, box, cmp, { now = Date.now(), onRefresh = null, cards = false, today = new Date().getDay(), day = today, logo = () => null } = {}) {
  box.__cotoCc = { onRefresh };
  const when = day === today || !dayName(day) ? "hoy" : `el ${dayName(day).toLowerCase()}`;
  const logoOf = (id) => logo(id) ?? null;
  const winner = cmp.verdict?.winner ?? null;
  const view = {
    verdict: { ...verdictView(cmp, when), logo: winner ? logoOf(winner) : null },
    stores: cmp.stores.map((st) => storeView(st, cards, when, logoOf)),
    foot: footOf(cmp, now),
  };
  const sig = JSON.stringify(view);
  if (box.dataset.sig === sig) return;
  box.dataset.sig = sig;
  const touched = openOf(box);
  const top = el(doc, "div", `${CC}-verdict`);
  if (view.verdict.logo) top.append(logoImg(doc, view.verdict.logo, 36));
  const words = el(doc, "div", `${CC}-words`);
  words.append(el(doc, "div", `${CC}-answer`, view.verdict.text));
  if (view.verdict.sub) words.append(el(doc, "div", `${CC}-sub`, view.verdict.sub));
  top.append(words);
  const foot = el(doc, "div", `${CC}-foot`);
  const refresh = el(doc, "button", `${CC}-refresh`, "Actualizar");
  refresh.type = "button";
  foot.append(el(doc, "span", null, view.foot), refresh);
  box.replaceChildren(el(doc, "h2", `${CC}-title`, "Tu carrito en otros súper"), top, ...view.stores.map((s) => storeNode(doc, s, touched)), foot);
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
    const open = isOpen(now, id);
    btn.setAttribute("aria-expanded", String(open));
    if (btn.dataset.n) btn.textContent = commonLabel(btn.dataset.n, open);
    const list = box.querySelector(`[data-of="${id}"]`);
    if (list) list.hidden = !open;
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
// rearma cuando cambia, por eso se vuelve a poner). Ocupa su lugar desde el primer
// pintado y tiene alto fijo: el desplegable no cambia de tamaño cuando llega la respuesta.
// cmp: el resultado, o null mientras se espera. on: false si no hay nada que comparar.
export function paintMiniCompare(doc, box, cmp, { on = true } = {}) {
  let row = box.querySelector(`:scope > .${CC}-mini`);
  if (!on) return row?.remove();
  if (!row) {
    row = el(doc, "a", `coto-unit-sum-row ${CC}-mini`);
    row.setAttribute("href", "/carrito");
  }
  const text = cmp ? miniCartLine(cmp) ?? FEW : WAIT;
  if (row.textContent !== text) row.textContent = text;
  const wait = !cmp;
  if (row.classList.contains(`${CC}-mini--wait`) !== wait) row.classList.toggle(`${CC}-mini--wait`, wait);
  if (box.lastElementChild !== row) box.append(row);
}
