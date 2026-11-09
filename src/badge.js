// Caja "Precio real para comparar" en las tarjetas nativas de Coto y en la página de
// producto. Solo agrega nodos y atributos data-coto-unit-*; no borra nada de Coto.
import { dayName } from "./banks.js";
import { compareRows, paintCompare } from "./compare-ui.js";
import { formatMoney as $ } from "./money.js";

const SOURCE = "coto-unit";
const BOX = "coto-unit-box";
const MARK = "coto-unit-mark";
const BEST = "coto-unit-best";
const NOTICE = "coto-unit-notice";
const CMP = "coto-unit-cmp";
const EAN_ATTR = "data-coto-unit-ean";
const KEY_RE = /_\/R-[\w-]+/;
const MIN_FOR_BEST = 3;

const UNIT_TEXT = { kg: "kg", L: "L", unidad: "unidad", m2: "m²", m: "m", rollo10m: "10 m", panos100: "100 paños" };
const MARK_TEXT = { kg: "Por kilo", L: "Por litro", unidad: "Por unidad", m2: "Por m²", m: "Por metro", rollo10m: "Por 10 m", panos100: "Por 100 paños" };

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

// Versión corta para el carrusel, donde las tarjetas son angostas: "ICBC: $275".
export function formatBankShort(label) {
  if (!UNIT_TEXT[label?.group] || label.bankValue == null || !label.bankName) return null;
  return `${label.bankName}: ${$(label.bankValue)}`;
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

// compare: cliente de compare-client.js; sin él no se compara con otros súper.
export function installBadges(win, doc, { compare } = {}) {
  const today = () => new Date().getDay();
  const state = { labels: {}, marks: {}, seq: 0, day: today(), path: null, sig: undefined, markBest: true, compare: true };
  const requested = new Set(); // EAN ya pedidos: cada uno se pide una sola vez
  let watching = new WeakMap(); // caja -> EAN que espera verse para pedirse
  let io = null;

  function ask(ean) {
    if (!state.compare || requested.has(ean)) return;
    requested.add(ean);
    // Si el usuario apagó la comparación mientras tanto, la respuesta no pinta.
    compare.request(ean).then(() => state.compare && render());
  }

  // Pide el EAN la primera vez que la caja entra en pantalla (o enseguida si no se puede saber).
  function want(box, ean) {
    if (requested.has(ean)) return;
    if (!win.IntersectionObserver) return ask(ean);
    if (watching.get(box) === ean) return;
    io ??= new win.IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting || !watching.has(e.target)) continue;
        io.unobserve(e.target);
        const seen = watching.get(e.target);
        watching.delete(e.target);
        ask(seen);
      }
    });
    watching.set(box, ean);
    io.observe(box);
  }

  // Filas "en otros súper" al final de la caja, si hay EAN y precio de Coto para comparar.
  function paintCmp(box, label, variant) {
    const ean = compare && state.compare && label.ean && label.cmp ? label.ean : null;
    if (!ean) {
      if (box.hasAttribute(EAN_ATTR)) box.removeAttribute(EAN_ATTR);
      return paintCompare(box, null);
    }
    // Angular reusa tarjetas: si cambió el producto, el bloque viejo no puede quedar.
    if (box.getAttribute(EAN_ATTR) !== ean) {
      box.querySelector(":scope > ." + CMP)?.remove();
      box.setAttribute(EAN_ATTR, ean);
    }
    const results = compare.peek(ean);
    paintCompare(box, compareRows(label.cmp, results), variant);
    if (!results) want(box, ean);
  }

  // Caja con el precio para comparar. anchor: después de qué nodo va.
  // variant: "" (tarjeta), "pdp" (a lo ancho) o "mini" (carrusel: solo valor y banco).
  function paintBox(container, anchor, label, variant = "") {
    let box = container.querySelector(":scope > ." + BOX) ?? container.querySelector("." + BOX);
    const value = label ? formatValue(label) : null;
    if (!value) return box?.remove();
    if (!box) {
      box = doc.createElement("div");
      box.className = variant ? `${BOX} ${BOX}--${variant}` : BOX;
      if (anchor) anchor.after(box);
      else container.appendChild(box);
    }
    const mini = variant === "mini";
    upsert(box, "coto-unit-cap", mini ? null : "Precio real para comparar");
    upsert(box, "coto-unit-value", value);
    upsert(box, "coto-unit-note", mini ? null : formatNote(label));
    upsert(box, "coto-unit-bank", mini ? formatBankShort(label) : formatBank(label, state.day, today()));
    upsert(box, "coto-unit-bankno", mini ? null : formatBlocked(label.bankBlocked));
    paintCmp(box, label, variant);
    return box;
  }

  function setAttr(el, name, on) {
    if (on && !el.hasAttribute(name)) el.setAttribute(name, "");
    else if (!on && el.hasAttribute(name)) el.removeAttribute(name);
  }

  // Las líneas secundarias de Coto pasan a chicas y grises; "Precio Regular" tachado.
  // Solo se tacha si hay oferta (el cartel "PRECIO CON X%DTO"); si no, tachar sugiere
  // un descuento que no existe.
  function dimCoto(centro) {
    const onSale = !!centro.querySelector(".offer-crum");
    for (const s of centro.querySelectorAll("small:not(.offer-crum)")) {
      const t = s.textContent;
      if (/precio regular/i.test(t)) {
        s.setAttribute("data-coto-unit-dim", "");
        if (onSale) s.setAttribute("data-coto-unit-strike", "");
      } else if (/sin impuestos|precio por \d/i.test(t)) {
        s.setAttribute("data-coto-unit-dim", "");
      }
    }
  }

  // Si la tarjeta se quedó sin etiqueta (Angular la reusó), vuelve a verse como Coto.
  function undimCoto(centro) {
    for (const s of centro.querySelectorAll("[data-coto-unit-dim], [data-coto-unit-strike]")) {
      s.removeAttribute("data-coto-unit-dim");
      s.removeAttribute("data-coto-unit-strike");
    }
  }

  function renderCards() {
    const byGroup = new Map();
    const seen = new Set();
    for (const link of doc.querySelectorAll('a[href*="_/R-"]')) {
      const card = link.closest(".card-container");
      if (!card || seen.has(card)) continue; // una tarjeta puede tener varios links
      seen.add(card);
      const key = link.getAttribute("href").match(KEY_RE)?.[0];
      const label = key ? state.labels[key] : null;
      const centro = card.querySelector(".centro-precios") ?? card;
      const anchor = centro.querySelector(".descuentos-slot") ?? centro.querySelector("h4.card-title");
      const box = paintBox(centro, anchor, label);
      if (box) {
        dimCoto(centro);
        if (!byGroup.has(label.group)) byGroup.set(label.group, []);
        byGroup.get(label.group).push({ box, price: label.bankValue ?? label.value });
      } else {
        undimCoto(centro);
      }
      upsert(card, MARK, key && state.marks[key] ? groupMark(state.marks[key]) : null);
    }
    // "Más barato por <u>": la de menor precio de su grupo, si hay al menos 3 visibles.
    const winners = new Set();
    for (const [group, list] of state.markBest ? byGroup : []) {
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

  // Página de producto: la caja va a lo ancho, después del bloque que tiene el precio
  // (dentro de .mt-4), y las líneas secundarias de Coto se atenúan como en las tarjetas.
  function renderPdp() {
    const key = pdpKey();
    const price = doc.querySelector(".price");
    if (!key || !price) return;
    let block = price;
    while (block.parentElement && !block.parentElement.matches(".mt-4") && block !== doc.body) block = block.parentElement;
    const wrap = block.parentElement?.matches(".mt-4") ? block.parentElement : null;
    const label = state.labels[key];
    if (!wrap) return paintBox(price.parentElement, price, label);
    const box = paintBox(wrap, block, label, "pdp");
    const onSale = /oferta|%\s*dto/i.test(block.textContent);
    for (const line of wrap.children) {
      if (line === block || line === box) continue;
      const t = line.textContent;
      // Solo líneas cortas de texto: un bloque con botones o mucho texto no es "secundario".
      if (line.querySelector("button, input, a") || t.length > 120) continue;
      const regular = /precio regular/i.test(t);
      setAttr(line, "data-coto-unit-dim", !!box && (regular || /sin impuestos|precio por \d/i.test(t)));
      setAttr(line, "data-coto-unit-strike", !!box && regular && onSale);
    }
  }

  // Carrusel "También te pueden interesar": tarjetas sin link, por id de producto.
  function renderMini() {
    for (const card of doc.querySelectorAll(".mini-product-card[data-cnstrc-item-id]")) {
      const label = state.labels[card.getAttribute("data-cnstrc-item-id")];
      const section = card.querySelector(".mini-product-card__price-section");
      if (!section) continue;
      const box = paintBox(section.parentElement, section, label, "mini");
      const ref = card.querySelector(".mini-product-card__reference-price");
      if (ref) setAttr(ref, "data-coto-unit-dim", !!box);
    }
  }

  function render() {
    renderCards();
    renderPdp();
    renderMini();
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
      state.markBest = m.markBest !== false;
      state.compare = m.compareStores !== false;
      if (!state.compare) {
        io?.disconnect();
        watching = new WeakMap();
        for (const el of doc.querySelectorAll(`.${BOX} > .${CMP}`)) el.remove();
      }
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
