// Precio por unidad en Coto: tarjetas de las listas, página de producto y carrusel.
// En las tarjetas, un bloque propio ordena el precio (oferta, precio, precio por unidad) y
// las partes de Coto que repetían lo mismo se ocultan con atributos data-coto-unit-*.
// Nunca se borra un nodo de Coto: sin etiqueta, la tarjeta vuelve a verse como siempre.
import { dayName } from "./banks.js";

const SOURCE = "coto-unit";
const BOX = "coto-unit-box";
const BLOCK = "coto-unit-price";
const MARK = "coto-unit-mark";
const NOTICE = "coto-unit-notice";
const KEY_RE = /_\/R-[\w-]+/;

const HIDE = "data-coto-unit-hide";
const DIM = "data-coto-unit-dim";
const CARD = "data-coto-unit-card";

const UNIT_TEXT = { kg: "kg", L: "L", unidad: "unidad", m2: "m²", m: "m", rollo10m: "10 m", panos100: "100 paños" };
const UNIT_LONG = { kg: "kilo", L: "litro", unidad: "unidad", m2: "m²", m: "metro", rollo10m: "10 metros", panos100: "100 paños" };
const MARK_TEXT = { kg: "Por kilo", L: "Por litro", unidad: "Por unidad", m2: "Por m²", m: "Por metro", rollo10m: "Por 10 m", panos100: "Por 100 paños" };
const money = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });
const money2 = new Intl.NumberFormat("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const $ = (n) => "$" + money.format(n);
const $2 = (n) => "$" + money2.format(n);

// El único precio por unidad que se muestra: el mismo que ordena (con banco si aplica).
export function unitValue(label) {
  return label?.bankValue ?? label?.value ?? null;
}

export function formatUnit(label) {
  const unit = UNIT_TEXT[label?.group];
  const value = unitValue(label);
  if (!unit || value == null) return null;
  return `${$(value)} /${unit}`;
}

// Por qué ese precio: banco, promo por cantidad, Comunidad o 1 pago.
export function formatWhy(label, day, today, short = false) {
  if (label?.bankValue != null && label.bankName) {
    if (short) return label.bankName;
    return day === today ? `con ${label.bankName} hoy` : `con ${label.bankName} el ${dayName(day).toLowerCase()}`;
  }
  if (label?.take > 1) return `llevando ${label.take}`;
  if (label?.via === "comunidad") return short ? "Comunidad" : "con Comunidad";
  if (label?.via === "1pago") return "en 1 pago";
  return null;
}

// Notas que cambian cómo se compara: escurrido, doble hoja, metros estimados.
export function formatNote(label) {
  const parts = [label?.drained ? "escurrido" : null, label?.note ?? null].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

export function formatBlocked(reason) {
  if (reason === "oferta") return "Banco no aplica: ya está en oferta";
  if (reason === "excluido") return "Banco no aplica: excluido de promos";
  return null;
}

export function groupMark(group) {
  return MARK_TEXT[group] ? "▸ " + MARK_TEXT[group] : null;
}

function upsert(parent, cls, text, before = null, tag = "div") {
  let el = parent.querySelector(":scope > ." + cls);
  if (!text) return el?.remove();
  if (!el) {
    el = parent.ownerDocument.createElement(tag);
    el.className = cls;
    if (before && before.parentNode === parent) parent.insertBefore(el, before);
    else parent.appendChild(el);
  }
  if (el.textContent !== text) el.textContent = text;
  return el;
}

// Deja los hijos en ese orden; solo mueve si hace falta (cada movida dispara el observador).
function order(parent, classes) {
  const kids = classes.map((c) => parent.querySelector(":scope > ." + c)).filter(Boolean);
  const now = [...parent.children].filter((el) => kids.includes(el));
  if (now.every((el, i) => el === kids[i])) return;
  for (const el of kids) parent.appendChild(el);
}

// Contenedor hijo con esa clase (lo crea si falta). No toca su contenido.
function ensure(parent, cls, tag = "div") {
  let el = parent.querySelector(":scope > ." + cls);
  if (!el) {
    el = parent.ownerDocument.createElement(tag);
    el.className = cls;
    parent.appendChild(el);
  }
  return el;
}

function setAttr(el, name, on) {
  if (on && !el.hasAttribute(name)) el.setAttribute(name, "");
  else if (!on && el.hasAttribute(name)) el.removeAttribute(name);
}

export function installBadges(win, doc) {
  const today = () => new Date().getDay();
  const state = { labels: {}, marks: {}, best: {}, seq: 0, bestSeq: -1, day: today(), path: null, sig: undefined, markBest: true };

  const unitTitle = (label) => `Precio por ${UNIT_LONG[label.group] ?? label.group} para comparar con otros productos`;

  // Fila "precio por unidad + motivo". Sirve en tarjeta, producto y carrusel.
  function paintUnit(parent, label, short = false) {
    const row = ensure(parent, "coto-unit-unit");
    const title = unitTitle(label);
    if (row.title !== title) row.title = title;
    upsert(row, "coto-unit-value", formatUnit(label), null, "span");
    upsert(row, "coto-unit-why", formatWhy(label, state.day, today(), short), null, "span");
    return row;
  }

  // ---------- Tarjetas de las listas ----------

  function paintCardBlock(centro, name, label, key) {
    let block = centro.querySelector(":scope > ." + BLOCK);
    if (!block) {
      block = doc.createElement("div");
      block.className = BLOCK;
      if (name) name.after(block);
      else centro.prepend(block);
    }
    // Sin oferta el lugar queda reservado (invisible): los precios vecinos quedan alineados.
    const offer = upsert(block, "coto-unit-offer", label.offerText ?? " ");
    setAttr(offer, "data-coto-unit-empty", !label.offerText);
    const priceRow = ensure(block, "coto-unit-pricerow");
    upsert(priceRow, "coto-unit-final", label.price != null ? $2(label.price) : null, null, "span");
    const regular = label.list != null && label.price != null && label.list > label.price + 0.5 ? $2(label.list) : null;
    upsert(priceRow, "coto-unit-regular", regular, null, "s");
    paintUnit(block, label);
    upsert(block, "coto-unit-note", formatNote(label));
    const best = state.markBest && key && state.best[key] ? "Más barato de la categoría" : null;
    upsert(block, "coto-unit-best", best);
    order(block, ["coto-unit-offer", "coto-unit-pricerow", "coto-unit-unit", "coto-unit-note", "coto-unit-best"]);
    return block;
  }

  // Qué partes de Coto repiten lo que ya muestra el bloque.
  function cotoParts(centro) {
    const hide = new Set();
    const dim = new Set();
    for (const el of centro.querySelectorAll(".descuentos-slot")) hide.add(el);
    for (const el of centro.querySelectorAll("h4.card-title")) if (!el.closest(".descuentos-slot")) hide.add(el);
    for (const el of centro.querySelectorAll("small")) {
      const t = el.textContent;
      if (/precio regular/i.test(t)) hide.add(el);
      else if (/sin impuestos/i.test(t)) dim.add(el);
    }
    for (const child of centro.children) {
      if (child.classList.contains(BLOCK) || child.querySelector("button, input")) continue;
      const t = child.textContent;
      if (/precio por \d/i.test(t) || /con\s*comunidad\s*pagas/i.test(t)) hide.add(child);
    }
    return { hide, dim };
  }

  function restoreCard(card, centro) {
    centro.querySelector(":scope > ." + BLOCK)?.remove();
    for (const el of card.querySelectorAll(`[${HIDE}], [${DIM}]`)) {
      el.removeAttribute(HIDE);
      el.removeAttribute(DIM);
    }
    setAttr(card, CARD, false);
  }

  function renderCards() {
    const seen = new Set();
    for (const link of doc.querySelectorAll('a[href*="_/R-"]')) {
      const card = link.closest(".card-container");
      if (!card || seen.has(card)) continue; // una tarjeta puede tener varios links
      seen.add(card);
      const key = link.getAttribute("href").match(KEY_RE)?.[0];
      const label = key ? state.labels[key] : null;
      const centro = card.querySelector(".centro-precios") ?? card;
      if (!label || !formatUnit(label) || label.price == null) {
        restoreCard(card, centro);
      } else {
        setAttr(card, CARD, true);
        paintCardBlock(centro, centro.querySelector(":scope > .nombre-producto, :scope > h3"), label, key);
        const { hide, dim } = cotoParts(centro);
        for (const el of centro.querySelectorAll(`[${HIDE}]`)) if (!hide.has(el)) el.removeAttribute(HIDE);
        for (const el of hide) setAttr(el, HIDE, true);
        for (const el of dim) setAttr(el, DIM, true);
      }
      upsert(card, MARK, key && state.marks[key] ? groupMark(state.marks[key]) : null);
    }
  }

  // ---------- Página de producto y carrusel ----------

  // Caja con el precio para comparar. anchor: después de qué nodo va.
  // variant: "pdp" (a lo ancho) o "mini" (carrusel: solo la fila de unidad).
  function paintBox(container, anchor, label, variant) {
    let box = container.querySelector(":scope > ." + BOX) ?? container.querySelector("." + BOX);
    if (!label || !formatUnit(label)) return box?.remove();
    if (!box) {
      box = doc.createElement("div");
      box.className = `${BOX} ${BOX}--${variant}`;
      if (anchor) anchor.after(box);
      else container.appendChild(box);
    }
    const mini = variant === "mini";
    upsert(box, "coto-unit-cap", mini ? null : "Precio real para comparar");
    paintUnit(box, label, mini);
    upsert(box, "coto-unit-note", mini ? null : formatNote(label));
    upsert(box, "coto-unit-bankno", mini ? null : formatBlocked(label.bankBlocked));
    order(box, ["coto-unit-cap", "coto-unit-unit", "coto-unit-note", "coto-unit-bankno"]);
    return box;
  }

  function pdpKey() {
    return String(win.location?.pathname ?? "").match(KEY_RE)?.[0] ?? null;
  }

  // Página de producto: la caja va a lo ancho debajo del precio (dentro de .mt-4). El
  // "Precio por 1 …" de Coto (sobre el precio sin oferta) se oculta; lo demás se atenúa.
  function renderPdp() {
    const key = pdpKey();
    const price = doc.querySelector(".price");
    if (!key || !price) return;
    let block = price;
    while (block.parentElement && !block.parentElement.matches(".mt-4") && block !== doc.body) block = block.parentElement;
    const wrap = block.parentElement?.matches(".mt-4") ? block.parentElement : null;
    const label = state.labels[key];
    if (!wrap) return paintBox(price.parentElement, price, label, "pdp");
    const box = paintBox(wrap, block, label, "pdp");
    const onSale = /oferta|%\s*dto/i.test(block.textContent);
    for (const line of wrap.children) {
      if (line === block || line === box) continue;
      const t = line.textContent;
      // Solo líneas cortas de texto: un bloque con botones o mucho texto no es "secundario".
      if (line.querySelector("button, input, a") || t.length > 120) continue;
      const regular = /precio regular/i.test(t);
      setAttr(line, HIDE, !!box && /precio por \d/i.test(t));
      setAttr(line, DIM, !!box && (regular || /sin impuestos/i.test(t)));
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
      if (ref) setAttr(ref, HIDE, !!box);
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
      // Si cambió el día, las promos o Comunidad, los datos de banco viejos mienten: se
      // borran hasta que lleguen etiquetas nuevas.
      const sig = (m.selected ?? []).map((p) => p.id).join(",") + "@" + state.day + (m.comunidad === false ? "#sc" : "");
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
    if (m.type === "best") {
      // El más barato de la categoría: el último pedido manda.
      if (typeof m.seq === "number" && m.seq < state.bestSeq) return;
      if (typeof m.seq === "number") state.bestSeq = m.seq;
      state.best = m.best ?? {};
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
