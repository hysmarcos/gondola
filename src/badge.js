// Precio por unidad en Coto: tarjetas de las listas, página de producto y carrusel.
// En las tarjetas, un bloque propio ordena el precio (oferta, precio, precio por unidad) y
// las partes de Coto que repetían lo mismo se ocultan con atributos data-coto-unit-*.
// Nunca se borra un nodo de Coto: sin etiqueta, la tarjeta vuelve a verse como siempre.
import { dayName } from "./banks.js";
import { compareRows, paintCompare } from "./compare-ui.js";

const SOURCE = "coto-unit";
const BOX = "coto-unit-box";
const BLOCK = "coto-unit-price";
const MARK = "coto-unit-mark";
const TAGS = "coto-unit-tags";
const NOTICE = "coto-unit-notice";
const CMP = "coto-unit-cmp";
const EAN_ATTR = "data-coto-unit-ean";
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

// Condición del precio grande de la tarjeta: cuánto llevar, Comunidad o 1 pago.
export function formatCond(label) {
  if (label?.take > 1) return `c/u llevando ${label.take}`;
  if (label?.via === "comunidad") return "con Comunidad";
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

// deps.logoUrl(icono) → URL del logo del banco (o null para mostrar solo el nombre).
// deps.compare: cliente de compare-client.js; sin él no se compara con otros súper.
export function installBadges(win, doc, deps = {}) {
  const logoUrl = deps.logoUrl ?? (() => null);
  const compare = deps.compare ?? null;
  const today = () => new Date().getDay();
  const state = { labels: {}, marks: {}, best: {}, bestScope: "categoria", comunidad: undefined, seq: 0, bestSeq: -1, day: today(), path: null, sig: undefined, markBest: true, compare: true };
  const requested = new Set(); // EAN ya pedidos: cada uno se pide una sola vez
  let watching = new WeakMap(); // caja -> EAN que espera verse para pedirse
  let io = null;
  let scheduled = false;

  const unitTitle = (label) => `Precio por ${UNIT_LONG[label.group] ?? label.group} para comparar con otros productos`;

  // ---------- Otros súper ----------

  // Un lote de respuestas llega junto: un solo repintado por cuadro, no uno por EAN.
  // Si el usuario apagó la comparación mientras tanto, la respuesta no pinta.
  function renderSoon() {
    if (scheduled) return;
    scheduled = true;
    const run = () => {
      scheduled = false;
      if (state.compare) render();
    };
    if (typeof win.requestAnimationFrame === "function") win.requestAnimationFrame(run);
    else queueMicrotask(run);
  }

  function ask(ean) {
    if (!state.compare || requested.has(ean)) return;
    requested.add(ean);
    compare.request(ean).then(renderSoon);
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

  // Filas "en otros súper" como último hijo del bloque de precio (tarjeta, PDP o carrusel),
  // si hay EAN y precio de Coto para comparar.
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

  // Fila "precio por unidad + motivo". Sirve en tarjeta, producto y carrusel.
  // bankOnly: en la tarjeta el resto del motivo ya está al lado del precio grande.
  function paintUnit(parent, label, short = false, bankOnly = false) {
    const row = ensure(parent, "coto-unit-unit");
    const title = unitTitle(label);
    if (row.title !== title) row.title = title;
    upsert(row, "coto-unit-value", formatUnit(label), null, "span");
    const why = bankOnly ? null : formatWhy(label, state.day, today(), short);
    const logo = label.bankValue != null && label.bankName ? logoUrl(label.bankLogo) : null;
    if (why && logo) paintBankChip(row, label, why, logo, short);
    else upsert(row, "coto-unit-why", why, null, "span");
    order(row, ["coto-unit-value", "coto-unit-why"]);
    return row;
  }

  // Motivo con banco: el logo en lugar del nombre ("[ICBC] hoy"); el texto completo queda
  // para lectores de pantalla y al pasar el mouse.
  function paintBankChip(row, label, why, logo, short) {
    let chip = row.querySelector(":scope > .coto-unit-why");
    if (chip && !chip.querySelector(":scope > img")) {
      chip.remove();
      chip = null;
    }
    if (!chip) {
      chip = doc.createElement("span");
      chip.className = "coto-unit-why";
      const img = doc.createElement("img");
      img.className = "coto-unit-logo";
      chip.appendChild(img);
      row.appendChild(chip);
    }
    const img = chip.querySelector(":scope > img");
    if (img.getAttribute("src") !== logo) img.setAttribute("src", logo);
    if (img.getAttribute("alt") !== label.bankName) img.setAttribute("alt", label.bankName);
    if (chip.getAttribute("aria-label") !== why) chip.setAttribute("aria-label", why);
    if (chip.title !== why) chip.title = why;
    const when = short ? null : why.replace(`con ${label.bankName} `, "");
    upsert(chip, "coto-unit-when", when, null, "span");
  }

  // ---------- Tarjetas de las listas ----------

  // Cuerpo de la tarjeta en filas fijas, iguales en todas: precio, detalle, unidad.
  function paintCardBlock(centro, name, label) {
    let block = centro.querySelector(":scope > ." + BLOCK);
    if (!block) {
      block = doc.createElement("div");
      block.className = BLOCK;
      if (name) name.after(block);
      else centro.prepend(block);
    }
    // Precio grande: el mejor que se paga hoy (promo de Coto o banco), con el original
    // tachado al lado y el ícono de comparación con otros súper.
    const priceRow = ensure(block, "coto-unit-pricerow");
    const big = label.bankPrice ?? label.price;
    upsert(priceRow, "coto-unit-final", big != null ? $2(big) : null, null, "span");
    const regular = label.list != null && big != null && label.list > big + 0.5 ? $2(label.list) : null;
    upsert(priceRow, "coto-unit-sr", regular ? "Precio original:" : null, null, "span");
    upsert(priceRow, "coto-unit-regular", regular, null, "s");
    order(priceRow, ["coto-unit-final", "coto-unit-sr", "coto-unit-regular"]);
    // Comparación con otros súper: una pastilla en su propia fila, debajo del precio.
    paintCmp(ensure(block, "coto-unit-cmprow"), label, "icon");
    // Detalle: por qué ese precio (banco con su logo, cuánto llevar, Comunidad) y notas de
    // la medida. Sin detalle la fila queda reservada: las tarjetas no saltan.
    paintDetail(block, label);
    // Precio por unidad: un solo número, de referencia, abajo.
    paintUnit(block, label, false, true);
    order(block, ["coto-unit-pricerow", "coto-unit-detail", "coto-unit-cmprow", "coto-unit-unit"]);
    return block;
  }

  function paintDetail(block, label) {
    const bank = label.bankPrice != null && !!label.bankName;
    const when = state.day === today() ? "hoy" : `el ${dayName(state.day).toLowerCase()}`;
    const text = [bank ? `${label.bankPercent}% ${when}` : formatCond(label), formatNote(label)].filter(Boolean).join(" · ");
    const logo = bank ? logoUrl(label.bankLogo) : null;
    const row = ensure(block, "coto-unit-detail");
    const sig = [text, logo, bank ? label.bankName : ""].join("|");
    if (row.dataset.sig !== sig) {
      row.dataset.sig = sig;
      const parts = [];
      if (bank && logo) {
        // Con logo, el nombre del banco va en el texto alternativo.
        const img = doc.createElement("img");
        img.className = "coto-unit-logo";
        img.setAttribute("src", logo);
        img.setAttribute("alt", label.bankName);
        parts.push(doc.createTextNode("con "), img, doc.createTextNode(" " + text));
      } else if (bank) {
        parts.push(doc.createTextNode(`con ${label.bankName} ${text}`));
      } else {
        parts.push(doc.createTextNode(text || " "));
      }
      row.replaceChildren(...parts);
    }
    setAttr(row, "data-coto-unit-empty", !text);
    setAttr(row, "data-coto-unit-bank", bank);
  }


  // Etiquetas sobre la imagen, arriba a la izquierda: más barato, la oferta (una sola vez)
  // y el inicio de grupo al ordenar por unidad. Reemplazan las cucardas de Coto.
  function paintTags(card, label, key) {
    const best = state.markBest && key && state.best[key]
      ? (state.bestScope === "lista" ? "Más barato de esta lista" : "Más barato de la categoría")
      : null;
    const mark = key && state.marks[key] ? groupMark(state.marks[key]) : null;
    let tags = card.querySelector("." + TAGS);
    // Sin nada que mostrar no se crea (crear y borrar en cada vuelta dispararía el observador).
    if (!best && !label.offerText && !mark) return tags?.remove();
    if (!tags) {
      tags = doc.createElement("div");
      tags.className = TAGS;
      const area = card.querySelector(".top-imagen-promos .promos") ?? card.querySelector(".top-imagen-promos") ?? card;
      area.prepend(tags);
    }
    upsert(tags, "coto-unit-best", best);
    upsert(tags, "coto-unit-offer", label.offerText);
    upsert(tags, MARK, mark);
    order(tags, ["coto-unit-best", "coto-unit-offer", MARK]);
  }

  // Qué partes de Coto repiten lo que ya muestra el bloque.
  function cotoParts(card, centro) {
    const hide = new Set();
    const dim = new Set();
    // Las cucardas de la imagen ("LLEVANDO 2", "2X1", "NO ACUMULABLE…"): ya están en las etiquetas.
    for (const el of card.querySelectorAll(".top-imagen-promos .cucarda-promo")) hide.add(el);
    for (const el of centro.querySelectorAll(".descuentos-slot")) hide.add(el);
    for (const el of centro.querySelectorAll("h4.card-title")) if (!el.closest(".descuentos-slot")) hide.add(el);
    for (const el of centro.querySelectorAll("small")) {
      const t = el.textContent;
      if (/precio regular/i.test(t)) hide.add(el);
      else if (/sin impuestos/i.test(t)) dim.add(el);
    }
    for (const child of centro.children) {
      // Nunca un bloque con botones, links o el nombre del producto.
      if (child.classList.contains(BLOCK) || child.querySelector("button, input, a, h3, .nombre-producto")) continue;
      const t = child.textContent;
      if (t.length > 80 || /sin impuestos/i.test(t)) continue;
      if (/precio por \d/i.test(t) || /con\s*comunidad\s*pagas/i.test(t)) hide.add(child);
    }
    return { hide, dim };
  }

  function restoreCard(card, centro) {
    centro.querySelector(":scope > ." + BLOCK)?.remove();
    card.querySelector("." + TAGS)?.remove();
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
        paintCardBlock(centro, centro.querySelector(":scope > .nombre-producto, :scope > h3"), label);
        paintTags(card, label, key);
        const { hide, dim } = cotoParts(card, centro);
        for (const el of card.querySelectorAll(`[${HIDE}]`)) if (!hide.has(el)) el.removeAttribute(HIDE);
        for (const el of card.querySelectorAll(`[${DIM}]`)) if (!dim.has(el)) el.removeAttribute(DIM);
        for (const el of hide) setAttr(el, HIDE, true);
        for (const el of dim) setAttr(el, DIM, true);
      }
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
    paintCmp(box, label, mini ? "mini" : "icon");
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
      setAttr(line, HIDE, !!box && /precio por \d/i.test(t) && !regular);
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
    // Otra página: el "más barato" de la anterior no vale hasta que llegue el nuevo.
    if (state.path !== null) state.best = {};
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
        for (const el of doc.querySelectorAll(`.${BOX} > .${CMP}, .${BLOCK} > .${CMP}`)) el.remove();
      }
      // Si cambió el día, las promos o Comunidad, los datos de banco viejos mienten: se
      // borran hasta que lleguen etiquetas nuevas.
      const comunidad = m.comunidad !== false;
      const sig = (m.selected ?? []).map((p) => p.id).join(",") + "@" + state.day + (comunidad ? "" : "#sc");
      if (state.comunidad !== undefined && comunidad !== state.comunidad) {
        // Los precios con o sin Comunidad cambian todo: se descartan y la PDP pide de nuevo.
        state.labels = {};
        state.path = null;
        checkPath();
      }
      state.comunidad = comunidad;
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
      state.bestScope = m.scope ?? "categoria";
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
