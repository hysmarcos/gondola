// En /carrito: avisos de promos incompletas y caja con lo que se paga de verdad.
// Solo agrega nodos; no toca el carrito de Coto.
import { dayName } from "./banks.js";
import { parseMoney } from "./money.js";

const SOURCE = "coto-unit";
const WARN = "coto-unit-cart-warn";
const BOX = "coto-unit-cart-box";
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

// Líneas de la caja: { text, promo } (promo: la del banco, para su logo).
function boxLines(a, day, today) {
  const out = [{ text: `Total con promos de Coto: ${$(a.total)}` }];
  if (a.today) {
    const when = day === today ? "Hoy" : dayName(day);
    out.push({ text: `${when} con ${a.today.promo.bank}: ${$(a.today.total)} (reintegro ${$(a.today.refund)})`, promo: a.today.promo });
  }
  if (a.best && a.best.day !== day) {
    out.push({ text: `Mejor día: ${dayName(a.best.day).toLowerCase()} con ${a.best.promo.bank}, ${$(a.best.total)}`, promo: a.best.promo });
  }
  for (const bank of a.weeklyCapBanks ?? []) out.push({ text: `El tope de ${bank} es semanal.` });
  return out;
}

// Firma de las líneas: si no cambió, la caja no se reescribe (el observador volvería a llamar).
const sigOf = (lines) => lines.map((l) => l.text + "|" + (l.promo?.logo ?? "")).join("\n");

// deps.logoUrl(icono) → URL del logo del banco, o null.
export function installCartUi(win, doc, deps = {}) {
  const logoUrl = deps.logoUrl ?? (() => null);

  // Una línea de caja: logo del banco (si hay) y el texto.
  function lineNode({ text, promo }) {
    const div = doc.createElement("div");
    const src = promo ? logoUrl(promo.logo) : null;
    if (!src) {
      div.textContent = text;
      return div;
    }
    div.className = "coto-unit-line-bank";
    const img = doc.createElement("img");
    img.className = "coto-unit-logo";
    img.setAttribute("src", src);
    img.setAttribute("alt", promo.bank);
    div.append(img, doc.createTextNode(text));
    return div;
  }

  const state = { analysis: null, seq: -1, day: new Date().getDay(), path: null, miniOpen: false };
  const onCart = () => String(win.location?.pathname ?? "").startsWith("/carrito");

  function renderWarnings(a) {
    const byName = new Map(a.lines.map((l) => [normName(l.name), l]));
    for (const card of doc.querySelectorAll("card-product")) {
      const line = byName.get(normName(card.querySelector("a.title")?.textContent));
      const target = card.querySelector(".c__item-detail") ?? card;
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
    const text = sigOf(lines);
    if (box && box.dataset.text === text) return;
    if (!box) {
      box = doc.createElement("div");
      box.className = BOX;
      total.after(box);
    }
    box.dataset.text = text;
    box.replaceChildren(...lines.map(lineNode));
  }

  // Si el total de la página no coincide con el carrito que leímos (cambió una cantidad
  // y Coto no volvió a pedir el carrito), no mostramos nada para no mentir.
  function inSync(a) {
    const text = doc.querySelector(".card-body-container")?.textContent ?? "";
    const shown = parseMoney(text.match(/Total:\s*(\$\s*[\d.,]+)/)?.[1] ?? null);
    return shown === null || a.listTotal == null || Math.abs(shown - a.listTotal) <= 1;
  }

  function clear() {
    doc.querySelectorAll(`.${WARN}, .${BOX}`).forEach((e) => e.remove());
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
    const lines = [{ text: `Con promos: ${$(a.total)}` }];
    if (a.today) {
      const when = state.day === new Date().getDay() ? "Hoy" : dayName(state.day);
      lines.push({ text: `${when} con ${a.today.promo.bank}: ${$(a.today.total)}`, promo: a.today.promo });
    }
    const text = sigOf(lines);
    if (box && box.dataset.text === text) return;
    if (!box) {
      box = doc.createElement("div");
      box.className = "coto-unit-mini-total";
      totalEl.after(box);
    }
    box.dataset.text = text;
    box.replaceChildren(...lines.map(lineNode));
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
