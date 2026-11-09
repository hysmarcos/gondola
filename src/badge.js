// Etiquetas "$X/kg final" en las tarjetas nativas de Coto. Solo agrega nodos.
const SOURCE = "coto-unit";
const BADGE = "coto-unit-badge";
const MARK = "coto-unit-mark";
const NOTICE = "coto-unit-notice";
const KEY_RE = /_\/R-[\w-]+/;

const UNIT_TEXT = { kg: "kg", L: "L", unidad: "unidad" };
const MARK_TEXT = { kg: "▸ Por kilo", L: "▸ Por litro", unidad: "▸ Por unidad" };
const money = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });

export function formatBadge(label) {
  const unit = UNIT_TEXT[label?.group];
  if (!unit || label.value == null) return null;
  return `$${money.format(label.value)}/${unit} ${label.drained ? "escurrido" : "final"}`;
}

export function groupMark(group) {
  return MARK_TEXT[group];
}

function cardOf(link) {
  return link.closest(".card-container") ?? link.parentElement;
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
  const state = { active: false, labels: {} };

  function clear() {
    doc.querySelectorAll(`.${BADGE}, .${MARK}`).forEach((el) => el.remove());
  }

  function render() {
    if (!state.active) return clear();
    for (const link of doc.querySelectorAll('a[href*="_/R-"]')) {
      const key = link.getAttribute("href").match(KEY_RE)?.[0];
      const label = key && state.labels[key];
      const card = cardOf(link);
      if (!card) continue;
      const target = card.querySelector(".centro-precios") ?? card;
      upsert(target, BADGE, label ? formatBadge(label) : null);
      upsert(card, MARK, label?.groupStart ? groupMark(label.group) : null);
    }
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
    if (m.type === "labels") {
      state.active = !!m.active;
      state.labels = m.active ? m.labels ?? {} : {};
      if (!m.active) doc.querySelector("." + NOTICE)?.remove();
      render();
    } else if (m.type === "notice") {
      notice(m.text);
    }
  });

  new win.MutationObserver(() => {
    if (state.active) render();
  }).observe(doc.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["href"] });
}
