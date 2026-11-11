// En /carrito: avisos de promos incompletas y caja con lo que se paga de verdad.
// Solo agrega nodos; no toca el carrito de Coto.
import { compareRows, paintCompare } from "./compare-ui.js";
import { parseMoney } from "./money.js";
import { summaryRows, paintSummary, $2 } from "./cart-summary.js";
import { cartNutrition, cartNutritionRows } from "./nutrition-cart.js";

const SOURCE = "coto-unit";
const WARN = "coto-unit-cart-warn";
const BOX = "coto-unit-cart-box";
const CMP = "coto-unit-cmp";
const HIDE = "data-coto-unit-hide";
const EAN_ATTR = "data-coto-unit-ean";
// Solo el bloque propio del carrito (hijo directo de su destino, ver paintLine); nunca
// el de una caja de precio de badge.js.
const CMP_SEL = `card-product .c__item-detail > .${CMP}, card-product > .${CMP}`;
const money = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });
const $ = (n) => "$" + money.format(n);

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

  function renderWarnings(a) {
    const byName = new Map(a.lines.map((l) => [normName(l.name), l]));
    for (const card of doc.querySelectorAll("card-product")) {
      const line = byName.get(normName(card.querySelector("a.title")?.textContent));
      const target = card.querySelector(".c__item-detail") ?? card;
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
    doc.querySelectorAll(`.${WARN}, .${BOX}, ${CMP_SEL}`).forEach((e) => e.remove());
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
    if (!menu) return;
    // Coto muestra "Total" y el monto en dos h4.roar-total: el monto es el último.
    const amounts = [...menu.querySelectorAll(".roar-total")].map((e) => parseMoney(e.textContent)).filter((n) => n !== null);
    const shownTotal = amounts.at(-1) ?? null;
    const ok = shownTotal === null || Math.abs(shownTotal - a.listTotal) <= 1;
    const byName = new Map(a.lines.map((l) => [normName(l.name), l]));
    for (const item of menu.querySelectorAll("card-product-float")) {
      const line = ok ? byName.get(normName(item.querySelector(".titulo-producto")?.textContent)) : null;
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
    paintSummary(doc, box, summaryRows(a, state.day, new Date().getDay()), logoUrl);
  }

  // Una línea del mini-carrito: precio de Coto tachado si hay promo, precio final con la
  // promo, y si aplica el banco, lo que queda con el reintegro.
  function paintMiniLine(item, line) {
    const precio = item.querySelector("p.precio");
    const coto = precio?.querySelector(".precio-final");
    let el = item.querySelector(".coto-unit-mini-line");
    const promo = line && line.discount > 0;
    const bank = line && line.bankShare > 0;
    if (!precio || (!promo && !bank)) {
      el?.remove();
      coto?.removeAttribute("data-coto-unit-strike");
      return;
    }
    if (!el) {
      el = doc.createElement("div");
      el.className = "coto-unit-mini-line";
      precio.after(el);
    }
    const sig = [promo, line.total, line.promoLabel, bank, line.bankShare, state.analysis?.today?.promo?.logo].join("|");
    if (el.dataset.sum !== sig) {
      el.dataset.sum = sig;
      const parts = [];
      if (promo) {
        const row = doc.createElement("div");
        row.className = "coto-unit-mini-promo";
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
        const promoBank = state.analysis?.today?.promo;
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
        row.append(doc.createTextNode(`${$2(line.total - line.bankShare)} con reintegro`));
        parts.push(row);
      }
      el.replaceChildren(...parts);
    }
    const strike = promo;
    if (strike && !coto?.hasAttribute("data-coto-unit-strike")) coto?.setAttribute("data-coto-unit-strike", "");
    if (!strike && coto?.hasAttribute("data-coto-unit-strike")) coto.removeAttribute("data-coto-unit-strike");
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
