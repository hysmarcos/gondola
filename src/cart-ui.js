// En /carrito: avisos de promos incompletas y caja con lo que se paga de verdad.
// Solo agrega nodos; no toca el carrito de Coto.
import { dayName } from "./banks.js";
import { compareRows, paintCompare } from "./compare-ui.js";
import { parseMoney } from "./money.js";

const SOURCE = "coto-unit";
const WARN = "coto-unit-cart-warn";
const BOX = "coto-unit-cart-box";
const CMP = "coto-unit-cmp";
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

function boxLines(a, day, today) {
  const out = [`Total con promos de Coto: ${$(a.total)}`];
  if (a.today) {
    const when = day === today ? "Hoy" : dayName(day);
    out.push(`${when} con ${a.today.promo.bank}: ${$(a.today.total)} (reintegro ${$(a.today.refund)})`);
  }
  if (a.best && a.best.day !== day) {
    out.push(`Mejor día: ${dayName(a.best.day).toLowerCase()} con ${a.best.promo.bank}, ${$(a.best.total)}`);
  }
  for (const bank of a.weeklyCapBanks ?? []) out.push(`El tope de ${bank} es semanal.`);
  return out;
}

// compare: cliente de compare-client.js; sin él no se compara con otros súper.
export function installCartUi(win, doc, { compare } = {}) {
  const state = { analysis: null, seq: -1, day: new Date().getDay(), path: null, miniOpen: false, compare: true };
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
    const lines = boxLines(a, state.day, new Date().getDay());
    const text = lines.join("\n");
    if (box && box.dataset.text === text) return;
    if (!box) {
      box = doc.createElement("div");
      box.className = BOX;
      total.after(box);
    }
    box.dataset.text = text;
    box.replaceChildren(...lines.map((t) => Object.assign(doc.createElement("div"), { textContent: t })));
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
    const shownTotal = parseMoney(menu.querySelector(".roar-total")?.textContent ?? null);
    const ok = shownTotal === null || Math.abs(shownTotal - a.listTotal) <= 1;
    const byName = new Map(a.lines.map((l) => [normName(l.name), l]));
    for (const item of menu.querySelectorAll("card-product-float")) {
      const line = byName.get(normName(item.querySelector(".titulo-producto")?.textContent));
      const precio = item.querySelector("p.precio");
      const coto = precio?.querySelector(".precio-final");
      let el = item.querySelector(".coto-unit-mini-line");
      const cheaper = ok && line && line.total < line.listTotal - 0.5;
      if (!cheaper || !precio) {
        el?.remove();
        coto?.removeAttribute("data-coto-unit-strike");
        continue;
      }
      if (!el) {
        el = doc.createElement("div");
        el.className = "coto-unit-mini-line";
        precio.after(el);
      }
      const text = `${$(line.total)} con promo`;
      if (el.textContent !== text) el.textContent = text;
      if (!coto?.hasAttribute("data-coto-unit-strike")) coto?.setAttribute("data-coto-unit-strike", "");
    }
    const totalEl = menu.querySelector(".total-precio");
    let box = menu.querySelector(".coto-unit-mini-total");
    if (!ok || !totalEl) return box?.remove();
    const lines = [`Con promos: ${$(a.total)}`];
    if (a.today) lines.push(`${state.day === new Date().getDay() ? "Hoy" : dayName(state.day)} con ${a.today.promo.bank}: ${$(a.today.total)}`);
    const text = lines.join("\n");
    if (box && box.dataset.text === text) return;
    if (!box) {
      box = doc.createElement("div");
      box.className = "coto-unit-mini-total";
      totalEl.after(box);
    }
    box.dataset.text = text;
    box.replaceChildren(...lines.map((t) => Object.assign(doc.createElement("div"), { textContent: t })));
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
