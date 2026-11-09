// Caja "Precio real para comparar" en las tarjetas nativas de Coto y en la página de
// producto. Solo agrega nodos y atributos data-coto-unit-*; no borra nada de Coto.
import { dayName } from "./banks.js";

const SOURCE = "coto-unit";
const BOX = "coto-unit-box";
const MARK = "coto-unit-mark";
const BEST = "coto-unit-best";
const NOTICE = "coto-unit-notice";
const KEY_RE = /_\/R-[\w-]+/;
const MIN_FOR_BEST = 3;

const UNIT_TEXT = { kg: "kg", L: "L", unidad: "unidad", m2: "m²", m: "m", rollo10m: "10 m", panos100: "100 paños" };
const MARK_TEXT = { kg: "Por kilo", L: "Por litro", unidad: "Por unidad", m2: "Por m²", m: "Por metro", rollo10m: "Por 10 m", panos100: "Por 100 paños" };
const money = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });
const $ = (n) => "$" + money.format(n);

export function formatValue(label) {
  const unit = UNIT_TEXT[label?.group];
  if (!unit || label.value == null) return null;
  return `${$(label.value)} /${unit}`;
}

export function formatNote(label) {
  const parts = [
    label?.take > 1 ? `llevando ${label.take}` : null,
    label?.drained ? "escurrido" : null,
    label?.note ?? null,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

// day: día de compra elegido; today: día de hoy (0 = domingo).
export function formatBank(label, day, today) {
  const unit = UNIT_TEXT[label?.group];
  if (!unit || label.bankValue == null || !label.bankName) return null;
  const when = day === today ? "Hoy" : dayName(day);
  return `${when} con ${label.bankName}: ${$(label.bankValue)}/${unit}`;
}

export function formatBlocked(reason) {
  if (reason === "oferta") return "Banco no aplica: ya está en oferta";
  if (reason === "excluido") return "Banco no aplica: excluido de promos";
  return null;
}

export function groupMark(group) {
  return MARK_TEXT[group] ? "▸ " + MARK_TEXT[group] : null;
}

function upsert(parent, cls, text, before = null) {
  let el = parent.querySelector(":scope > ." + cls);
  if (!text) return el?.remove();
  if (!el) {
    el = parent.ownerDocument.createElement("div");
    el.className = cls;
    if (before) parent.insertBefore(el, before);
    else parent.appendChild(el);
  }
  if (el.textContent !== text) el.textContent = text;
  return el;
}

export function installBadges(win, doc) {
  const today = () => new Date().getDay();
  const state = { labels: {}, marks: {}, seq: 0, day: today(), path: null, sig: undefined };

  // Caja con el precio para comparar. anchor: después de qué nodo va.
  function paintBox(container, anchor, label) {
    let box = container.querySelector("." + BOX);
    const value = label ? formatValue(label) : null;
    if (!value) return box?.remove();
    if (!box) {
      box = doc.createElement("div");
      box.className = BOX;
      if (anchor) anchor.after(box);
      else container.appendChild(box);
    }
    upsert(box, "coto-unit-cap", "Precio real para comparar");
    upsert(box, "coto-unit-value", value);
    upsert(box, "coto-unit-note", formatNote(label));
    upsert(box, "coto-unit-bank", formatBank(label, state.day, today()));
    upsert(box, "coto-unit-bankno", formatBlocked(label.bankBlocked));
    return box;
  }

  // Las líneas secundarias de Coto pasan a chicas y grises; "Precio Regular" tachado.
  function dimCoto(centro) {
    for (const s of centro.querySelectorAll("small")) {
      const t = s.textContent;
      if (/precio regular/i.test(t)) {
        s.setAttribute("data-coto-unit-dim", "");
        s.setAttribute("data-coto-unit-strike", "");
      } else if (/sin impuestos|precio por \d/i.test(t)) {
        s.setAttribute("data-coto-unit-dim", "");
      }
    }
  }

  function renderCards() {
    const byGroup = new Map();
    for (const link of doc.querySelectorAll('a[href*="_/R-"]')) {
      const card = link.closest(".card-container");
      if (!card) continue;
      const key = link.getAttribute("href").match(KEY_RE)?.[0];
      const label = key ? state.labels[key] : null;
      const centro = card.querySelector(".centro-precios") ?? card;
      const anchor = centro.querySelector(".descuentos-slot") ?? centro.querySelector("h4.card-title");
      const box = paintBox(centro, anchor, label);
      if (box) {
        dimCoto(centro);
        if (!byGroup.has(label.group)) byGroup.set(label.group, []);
        byGroup.get(label.group).push({ box, price: label.bankValue ?? label.value });
      }
      upsert(card, MARK, key && state.marks[key] ? groupMark(state.marks[key]) : null);
    }
    // "Más barato por <u>": la de menor precio de su grupo, si hay al menos 3 visibles.
    const winners = new Set();
    for (const [group, list] of byGroup) {
      if (list.length < MIN_FOR_BEST) continue;
      const min = list.reduce((a, b) => (b.price < a.price ? b : a));
      winners.add(min.box);
      upsert(min.box, BEST, `Más barato por ${UNIT_TEXT[group]}`, min.box.firstChild);
    }
    for (const el of doc.querySelectorAll("." + BEST)) {
      if (!winners.has(el.parentElement)) el.remove();
    }
  }

  function pdpKey() {
    return String(win.location?.pathname ?? "").match(KEY_RE)?.[0] ?? null;
  }

  function renderPdp() {
    const key = pdpKey();
    const price = doc.querySelector(".price");
    if (!key || !price) return;
    paintBox(price.parentElement, price, state.labels[key]);
  }

  function render() {
    renderCards();
    renderPdp();
  }

  function checkPath() {
    const path = win.location?.pathname ?? "";
    if (path === state.path) return;
    state.path = path;
    const key = pdpKey();
    const plu = key?.match(/R-(\d+)/)?.[1];
    if (plu) win.postMessage({ source: SOURCE, type: "lookup", plu: String(parseInt(plu, 10)), key }, "*");
  }

  function notice(text) {
    let el = doc.querySelector("." + NOTICE);
    if (!el) {
      el = doc.createElement("div");
      el.className = NOTICE;
      const header = doc.querySelector(".plp-header__sort");
      if (header) header.after(el);
      else doc.body.prepend(el);
    }
    el.textContent = text;
  }

  win.addEventListener("message", (e) => {
    const m = e.data;
    if (!m || m.source !== SOURCE) return;
    if (m.type === "settings") {
      state.day = Number(m.day) || 0;
      // Si cambió el día o las promos, las líneas de banco viejas mienten: se borran hasta
      // que lleguen etiquetas nuevas.
      const sig = (m.selected ?? []).map((p) => p.id).join(",") + "@" + state.day;
      if (state.sig !== undefined && sig !== state.sig) {
        for (const l of Object.values(state.labels)) {
          l.bankValue = null;
          l.bankName = null;
          l.bankBlocked = null;
        }
      }
      state.sig = sig;
      return render();
    }
    // Un pedido viejo que termina tarde no pisa marcas ni avisos del más nuevo.
    const fresh = typeof m.seq !== "number" || m.seq >= state.seq;
    if (typeof m.seq === "number" && fresh) state.seq = m.seq;
    if (m.type === "labels") {
      Object.assign(state.labels, m.labels ?? {});
      if ("marks" in m && fresh) {
        state.marks = m.marks ?? {};
        if (!m.marks) doc.querySelector("." + NOTICE)?.remove();
      }
      render();
    } else if (m.type === "notice" && fresh) {
      notice(m.text);
    }
  });

  checkPath();
  new win.MutationObserver(() => {
    checkPath();
    render();
  }).observe(doc.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["href"] });
}
