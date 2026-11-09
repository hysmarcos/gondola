// Etiquetas "$X/kg final" y "Hoy con <banco>" en las tarjetas nativas de Coto y en la
// página de producto. Solo agrega nodos.
import { dayName } from "./banks.js";

const SOURCE = "coto-unit";
const BADGE = "coto-unit-badge";
const BANK = "coto-unit-bank";
const MARK = "coto-unit-mark";
const NOTICE = "coto-unit-notice";
const PDP = "coto-unit-pdp";
const KEY_RE = /_\/R-[\w-]+/;

const UNIT_TEXT = { kg: "kg", L: "L", unidad: "unidad" };
const MARK_TEXT = { kg: "▸ Por kilo", L: "▸ Por litro", unidad: "▸ Por unidad" };
const money = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });

export function formatBadge(label) {
  const unit = UNIT_TEXT[label?.group];
  if (!unit || label.value == null) return null;
  const suffix = label.take > 1 ? `llevando ${label.take}` : label.drained ? "escurrido" : "final";
  return `$${money.format(label.value)}/${unit} ${suffix}`;
}

// day: día de compra elegido; today: día de hoy (0 = domingo).
export function formatBank(label, day, today) {
  const unit = UNIT_TEXT[label?.group];
  if (!unit || label.bankValue == null || !label.bankName) return null;
  const when = day === today ? "Hoy" : dayName(day);
  return `${when} con ${label.bankName}: $${money.format(label.bankValue)}/${unit}`;
}

export function groupMark(group) {
  return MARK_TEXT[group];
}

function upsert(parent, cls, text) {
  let el = parent.querySelector(":scope > ." + cls);
  if (!text) {
    el?.remove();
    return;
  }
  if (!el) {
    el = parent.ownerDocument.createElement("div");
    el.className = cls;
    parent.appendChild(el);
  }
  if (el.textContent !== text) el.textContent = text;
}

export function installBadges(win, doc) {
  const today = () => new Date().getDay();
  const state = { labels: {}, marks: {}, seq: 0, day: today(), path: null, sig: undefined };

  function paint(target, label) {
    upsert(target, BADGE, label ? formatBadge(label) : null);
    upsert(target, BANK, label ? formatBank(label, state.day, today()) : null);
  }

  function renderCards() {
    for (const link of doc.querySelectorAll('a[href*="_/R-"]')) {
      const card = link.closest(".card-container");
      if (!card) continue;
      const key = link.getAttribute("href").match(KEY_RE)?.[0];
      const label = key ? state.labels[key] : null;
      paint(card.querySelector(".centro-precios") ?? card, label);
      upsert(card, MARK, key && state.marks[key] ? groupMark(state.marks[key]) : null);
    }
  }

  function pdpKey() {
    return String(win.location?.pathname ?? "").match(KEY_RE)?.[0] ?? null;
  }

  function renderPdp() {
    const key = pdpKey();
    const label = key ? state.labels[key] : null;
    const price = doc.querySelector(".price");
    let box = doc.querySelector("." + PDP);
    if (!label || !price) return box?.remove();
    if (!box) {
      box = doc.createElement("div");
      box.className = PDP;
      price.after(box);
    }
    paint(box, label);
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
