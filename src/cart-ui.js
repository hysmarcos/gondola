// En /carrito: avisos de promos incompletas y caja con lo que se paga de verdad.
// Solo agrega nodos; no toca el carrito de Coto.
import { compareRows, paintCompare } from "./compare-ui.js";
import { parseMoney } from "./money.js";
import { summaryRows, paintSummary, closeSummaryPop, $2 } from "./cart-summary.js";
import { isComunidad } from "./banks.js";
import { cartNutrition, cartNutritionRows } from "./nutrition-cart.js";

const SOURCE = "coto-unit";
const WARN = "coto-unit-cart-warn";
const BOX = "coto-unit-cart-box";
const LINE = "coto-unit-mini-line";
const CART_LINE = "coto-unit-cart-line";
const TIP = "coto-unit-tip";
const LINK = "coto-unit-prod-link";
// Lo que sí se puede tocar en el mini-carrito de Coto. Un clic en cualquier otro lado
// no hace nada, y por eso no tiene que cerrar el desplegable.
const CLICKABLE = 'a, button, input, select, textarea, label, summary, [role="button"], [role="link"], [data-bs-dismiss], [data-dismiss]';

// La página del producto, solo si es de este mismo sitio (nada de otros sitios ni javascript:).
export function productHref(url, origin) {
  if (!url || !origin) return null;
  try {
    const u = new URL(String(url), origin);
    return /^https?:$/.test(u.protocol) && u.origin === origin && /\/_\/R-[\w-]+/.test(u.pathname) ? u.href : null;
  } catch {
    return null;
  }
}
const CMP = "coto-unit-cmp";
const HIDE = "data-coto-unit-hide";
const EAN_ATTR = "data-coto-unit-ean";
// Solo el bloque propio del carrito (hijo directo de su destino, ver paintLine); nunca
// el de una caja de precio de badge.js.
const CMP_SEL = `card-product .c__item-detail > .${CMP}, card-product > .${CMP}`;
const money = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });
const $ = (n) => "$" + money.format(n);

// Qué descuentos tiene una línea del carrito, para el globo de ayuda y los lectores de pantalla.
// promo: la promo del banco (o Comunidad) que se aplica hoy, o null.
export function discountRows(line, promo) {
  if (!line) return [];
  const rows = [];
  const hasPromo = line.discount > 0;
  const hasBank = line.bankShare > 0 && promo;
  if (!hasPromo && !hasBank) return rows;
  const units = line.qty > 1 ? ` (${line.qty} u.)` : "";
  rows.push({ label: `Precio de lista${units}`, value: $2(line.listTotal) });
  if (hasPromo) rows.push({ label: line.promoLabel ? `Promo de Coto: ${line.promoLabel}` : "Promo de Coto", value: "−" + $2(line.discount) });
  if (hasBank) {
    const direct = isComunidad(promo);
    rows.push({ label: `${direct ? "Descuento" : "Reintegro"} ${promo.bank} ${promo.percent}%`, value: "−" + $2(line.bankShare) });
  }
  const direct = hasBank && isComunidad(promo);
  rows.push({ label: hasBank && !direct ? "Te queda en" : "Pagás", value: $2(line.total - (hasBank ? line.bankShare : 0)), total: true });
  return rows;
}

export function normName(text) {
  return String(text ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

// deps.logoUrl(icono) → URL del logo del banco, o null.
// deps.compare: cliente de compare-client.js; sin él no se compara con otros súper.
export function installCartUi(win, doc, deps = {}) {
  const logoUrl = deps.logoUrl ?? (() => null);
  const compare = deps.compare ?? null;
  // Información nutricional de la compra: { request(ean) → Promise<Nutrition | "missing" | "error"> }.
  const nutrition = deps.nutrition ?? null;
  const nutriResults = new Map(); // ean -> resultado
  const nutriAsked = new Set();
  let nutriScheduled = false;

  const state = { analysis: null, seq: -1, day: new Date().getDay(), path: null, miniOpen: false, compare: true, nutrition: true };

  // Las respuestas de Open Food Facts llegan de a una: un solo repintado por cuadro.
  function nutriSoon() {
    if (nutriScheduled) return;
    nutriScheduled = true;
    const run = () => {
      nutriScheduled = false;
      render();
    };
    if (typeof win.requestAnimationFrame === "function") win.requestAnimationFrame(run);
    else queueMicrotask(run);
  }

  // Pide la tabla de cada producto de comida del carrito (una vez por EAN) y devuelve las
  // filas "Tu compra: …" para la caja.
  function nutritionRows(a) {
    if (!nutrition || !state.nutrition) return [];
    for (const l of a.lines) {
      const ean = l.nutri && l.ean ? String(l.ean) : null;
      if (!ean || nutriAsked.has(ean)) continue;
      nutriAsked.add(ean);
      Promise.resolve()
        .then(() => nutrition.request(ean))
        .catch(() => "error")
        .then((r) => {
          nutriResults.set(ean, r ?? "error");
          nutriSoon();
        });
    }
    return cartNutritionRows(cartNutrition(a.lines, nutriResults));
  }
  const requested = new Set(); // EAN ya pedidos: cada uno se pide una sola vez
  let scheduled = false;

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

  // Una línea del carrito por tarjeta: mejor precio de otro súper, si hay EAN y precio de Coto.
  function paintLine(target, line) {
    const ean = compare && state.compare && line?.ean && line.cmp ? line.ean : null;
    if (!ean) {
      if (target.hasAttribute(EAN_ATTR)) target.removeAttribute(EAN_ATTR);
      return paintCompare(target, null);
    }
    // Angular reusa tarjetas: si cambió el producto, el bloque viejo no puede quedar.
    if (target.getAttribute(EAN_ATTR) !== ean) {
      target.querySelector(":scope > ." + CMP)?.remove();
      target.setAttribute(EAN_ATTR, ean);
    }
    const results = compare.peek(ean);
    paintCompare(target, compareRows(line.cmp, results), "mini");
    if (!results) ask(ean);
  }
  const onCart = () => String(win.location?.pathname ?? "").startsWith("/carrito");

  // El nombre del producto abre su página en una pestaña nueva. Es un enlace de Góndola
  // encima del nombre: el nodo de Coto queda como está.
  function paintLink(title, line) {
    if (!title) return;
    const href = productHref(line?.url, win.location?.origin);
    let a = title.querySelector(":scope > ." + LINK);
    if (!href) return a?.remove();
    if (!a) {
      a = doc.createElement("a");
      a.className = LINK;
      a.setAttribute("target", "_blank");
      a.setAttribute("rel", "noopener");
      // El clic es de este enlace: ni Coto navega en esta pestaña ni se cierra el desplegable.
      a.addEventListener("click", (e) => e.stopPropagation());
      title.append(a);
    }
    if (a.getAttribute("href") !== href) a.setAttribute("href", href);
    const label = `Abrir ${line.name} en una pestaña nueva`;
    if (a.getAttribute("aria-label") !== label) {
      a.setAttribute("aria-label", label);
      a.setAttribute("title", "Abrir en una pestaña nueva");
    }
  }

  // Un clic en una zona sin nada para tocar no sale del mini-carrito: Coto no lo cierra.
  const kept = new WeakSet();
  function keepOpen(menu) {
    for (const child of menu.children) {
      if (kept.has(child)) continue;
      kept.add(child);
      child.addEventListener("click", (e) => {
        if (!e.target.closest?.(CLICKABLE)) e.stopPropagation();
      });
    }
  }

  function renderWarnings(a) {
    const byName = new Map(a.lines.map((l) => [normName(l.name), l]));
    for (const card of doc.querySelectorAll("card-product")) {
      const line = byName.get(normName(card.querySelector("a.title")?.textContent));
      const target = card.querySelector(".c__item-detail") ?? card;
      paintLink(card.querySelector("a.title"), line);
      paintCartLine(target, line);
      paintLine(target, line);
      let warn = target.querySelector(":scope > ." + WARN);
      if (!line || !line.missing) {
        warn?.remove();
        continue;
      }
      const text = `⚠ Agregá ${line.missing} más y se activa el ${line.promoText}: ahorrás ${$(line.saving)}`;
      if (!warn) {
        warn = doc.createElement("div");
        warn.className = WARN;
        target.appendChild(warn);
      }
      if (warn.textContent !== text) warn.textContent = text;
    }
  }

  function renderBox(a) {
    const total = doc.querySelector(".card-body-container");
    let box = doc.querySelector("." + BOX);
    if (!total) return box?.remove();
    if (!box) {
      box = doc.createElement("div");
      box.className = BOX;
      total.after(box);
    }
    paintSummary(doc, box, [...summaryRows(a, state.day, new Date().getDay(), { hints: true }), ...nutritionRows(a)], logoUrl);
  }

  // Si el total de la página no coincide con el carrito que leímos (cambió una cantidad
  // y Coto no volvió a pedir el carrito), no mostramos nada para no mentir.
  function inSync(a) {
    const text = doc.querySelector(".card-body-container")?.textContent ?? "";
    const shown = parseMoney(text.match(/Total:\s*(\$\s*[\d.,]+)/)?.[1] ?? null);
    return shown === null || a.listTotal == null || Math.abs(shown - a.listTotal) <= 1;
  }

  function clear() {
    doc.querySelectorAll(`.${WARN}, .${BOX}, .${CART_LINE}, card-product .${LINK}, ${CMP_SEL}`).forEach((e) => e.remove());
    hideTip();
  }

  function checkPath() {
    const path = String(win.location?.pathname ?? "");
    if (path === state.path) return;
    state.path = path;
    if (onCart()) win.postMessage?.({ source: SOURCE, type: "cartRequest" }, "*");
  }

  // Mini-carrito (desplegable del ícono): precio con promo por línea y totales.
  function renderMini(a) {
    const menu = doc.querySelector(".dropdown-carrito");
    if (!menu) return closeSummaryPop(doc);
    keepOpen(menu);
    // Coto muestra "Total" y el monto en dos h4.roar-total: el monto es el último.
    const amounts = [...menu.querySelectorAll(".roar-total")].map((e) => parseMoney(e.textContent)).filter((n) => n !== null);
    const shownTotal = amounts.at(-1) ?? null;
    const ok = shownTotal === null || Math.abs(shownTotal - a.listTotal) <= 1;
    const byName = new Map(a.lines.map((l) => [normName(l.name), l]));
    for (const item of menu.querySelectorAll("card-product-float")) {
      const title = item.querySelector(".titulo-producto");
      // El enlace no depende de los totales: va aunque el carrito leído esté viejo.
      paintLink(title, byName.get(normName(title?.textContent)));
      const line = ok ? byName.get(normName(title?.textContent)) : null;
      paintMiniLine(item, line);
    }
    const totalEl = menu.querySelector(".total-precio");
    let box = menu.querySelector(".coto-unit-mini-total");
    if (!ok || !totalEl) {
      totalEl?.removeAttribute(HIDE);
      return box?.remove();
    }
    // El "Total" de Coto pasa a ser el Subtotal de nuestro detalle.
    if (!totalEl.hasAttribute(HIDE)) totalEl.setAttribute(HIDE, "");
    if (!box) {
      box = doc.createElement("div");
      box.className = "coto-unit-mini-total";
      totalEl.after(box);
    }
    // El detalle se abre en un panel flotante: el mini-carrito mantiene su tamaño.
    paintSummary(doc, box, summaryRows(a, state.day, new Date().getDay()), logoUrl, { float: true, alive: () => menu.isConnected && menu.classList.contains("show") });
  }

  // El globo de ayuda: uno solo para toda la página, pegado a la ventana para que el
  // desplegable del carrito no lo corte.
  let tip = null;
  function hideTip() {
    if (tip) tip.hidden = true;
  }
  function showTip(el) {
    const rows = el.__cotoTip;
    if (!rows?.length) return;
    if (!tip) {
      tip = doc.createElement("div");
      tip.className = TIP;
      tip.id = TIP;
      tip.setAttribute("role", "tooltip");
      doc.body.append(tip);
    }
    tip.replaceChildren(...rows.map((r) => {
      const row = doc.createElement("div");
      row.className = `${TIP}-row` + (r.total ? ` ${TIP}-row--total` : "");
      const label = doc.createElement("span");
      label.textContent = r.label;
      const value = doc.createElement("span");
      value.textContent = r.value;
      row.append(label, value);
      return row;
    }));
    tip.hidden = false;
    const at = el.getBoundingClientRect();
    const size = tip.getBoundingClientRect();
    const vw = doc.documentElement.clientWidth || win.innerWidth || 0;
    const below = at.bottom + 6 + size.height <= (win.innerHeight || Infinity);
    tip.style.left = Math.max(8, Math.min(at.left, vw - size.width - 8)) + "px";
    tip.style.top = (below ? at.bottom + 6 : Math.max(8, at.top - size.height - 6)) + "px";
  }
  doc.addEventListener("keydown", (e) => { if (e.key === "Escape") hideTip(); });
  win.addEventListener("scroll", hideTip, true);

  // Arma (o actualiza) el bloque de una línea: precio de lista tachado (solo donde Coto
  // no lo muestra), precio con la promo y su etiqueta, y lo que queda con el banco.
  function fillLine(el, line, { list = false } = {}) {
    const promo = line.discount > 0;
    const bank = line.bankShare > 0;
    const promoBank = state.analysis?.today?.promo ?? null;
    const sig = [list, promo, line.total, line.listTotal, line.promoLabel, bank, line.bankShare, promoBank?.logo, promoBank?.percent, line.qty].join("|");
    if (el.dataset.sum === sig) return;
    el.dataset.sum = sig;
    const parts = [];
    if (promo) {
      const row = doc.createElement("div");
      row.className = "coto-unit-mini-promo";
      if (list) {
        const old = doc.createElement("s");
        old.className = "coto-unit-mini-list";
        old.textContent = $2(line.listTotal);
        row.append(old);
      }
      const final = doc.createElement("span");
      final.className = "coto-unit-mini-final";
      final.textContent = $2(line.total);
      row.append(final);
      if (line.promoLabel) {
        const tag = doc.createElement("span");
        tag.className = "coto-unit-sum-tag";
        tag.textContent = line.promoLabel;
        row.append(tag);
      }
      parts.push(row);
    }
    if (bank) {
      const row = doc.createElement("div");
      row.className = "coto-unit-mini-bank";
      const src = promoBank ? logoUrl(promoBank.logo) : null;
      if (src) {
        const img = doc.createElement("img");
        img.className = "coto-unit-logo";
        img.setAttribute("src", src);
        img.setAttribute("alt", promoBank.bank);
        row.append(img);
      }
      row.append(doc.createTextNode(`${$2(line.total - line.bankShare)} ${/comunidad/i.test(promoBank?.logo ?? "") ? "con Comunidad" : "con reintegro"}`));
      parts.push(row);
    }
    el.replaceChildren(...parts);
    // El detalle de los descuentos: al pasar el mouse o al llegar con el teclado.
    const rows = discountRows(line, promoBank);
    el.__cotoTip = rows;
    el.setAttribute("aria-label", rows.map((r) => `${r.label}: ${r.value}`).join(". "));
    if (el.dataset.tip) return;
    el.dataset.tip = "1";
    el.tabIndex = 0;
    el.setAttribute("role", "note");
    el.setAttribute("aria-describedby", TIP);
    el.addEventListener("mouseenter", () => showTip(el));
    el.addEventListener("focus", () => showTip(el));
    el.addEventListener("mouseleave", hideTip);
    el.addEventListener("blur", hideTip);
  }

  // Una línea del mini-carrito: precio de Coto tachado si hay promo, precio final con la
  // promo, y si aplica el banco, lo que queda con el reintegro.
  function paintMiniLine(item, line) {
    const precio = item.querySelector("p.precio");
    const coto = precio?.querySelector(".precio-final");
    let el = item.querySelector("." + LINE);
    const promo = line && line.discount > 0;
    const bank = line && line.bankShare > 0;
    if (!precio || (!promo && !bank)) {
      el?.remove();
      coto?.removeAttribute("data-coto-unit-strike");
      return;
    }
    if (!el) {
      el = doc.createElement("div");
      el.className = LINE;
      precio.after(el);
    }
    fillLine(el, line);
    const strike = promo;
    if (strike && !coto?.hasAttribute("data-coto-unit-strike")) coto?.setAttribute("data-coto-unit-strike", "");
    if (!strike && coto?.hasAttribute("data-coto-unit-strike")) coto.removeAttribute("data-coto-unit-strike");
  }

  // La misma línea en /carrito, dentro del detalle del producto. Acá no se toca el precio
  // de Coto: el de lista va tachado en el bloque de Góndola.
  function paintCartLine(target, line) {
    let el = target.querySelector(`:scope > .${CART_LINE}`);
    if (!line || !(line.discount > 0 || line.bankShare > 0)) return el?.remove();
    if (!el) {
      el = doc.createElement("div");
      el.className = `${LINE} ${CART_LINE}`;
      const before = target.querySelector(`:scope > .${CMP}, :scope > .${WARN}`);
      if (before) target.insertBefore(el, before);
      else target.appendChild(el);
    }
    fillLine(el, line, { list: true });
  }

  function checkMini() {
    const open = !!doc.querySelector(".dropdown-carrito.show");
    if (open && !state.miniOpen) win.postMessage?.({ source: SOURCE, type: "cartRequest" }, "*");
    state.miniOpen = open;
  }

  function render() {
    checkPath();
    checkMini();
    if (state.analysis) renderMini(state.analysis);
    if (!onCart() || !state.analysis) return;
    if (!inSync(state.analysis)) return clear();
    renderWarnings(state.analysis);
    renderBox(state.analysis);
  }

  win.addEventListener("message", (e) => {
    const m = e.data;
    if (m?.source !== SOURCE) return;
    if (m.type === "settings") {
      state.day = Number(m.day) || 0;
      state.compare = m.compareStores !== false;
      state.nutrition = m.nutrition !== false;
      if (!state.compare) doc.querySelectorAll(CMP_SEL).forEach((e) => e.remove());
    } else if (m.type === "cart" && m.analysis) {
      if (typeof m.seq === "number") {
        if (m.seq < state.seq) return;
        state.seq = m.seq;
      }
      state.analysis = m.analysis;
    } else {
      return;
    }
    render();
  });

  new win.MutationObserver(render).observe(doc.documentElement, { childList: true, subtree: true });
}
