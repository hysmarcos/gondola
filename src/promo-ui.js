// Aviso breve de promos por cantidad ("Promo 2x1: sumamos 1 gratis"). El número del
// contador lo fija pin-input.js en la página.

const SOURCE = "coto-unit";
const TOAST = "coto-unit-toast";
const TOAST_MS = 3500;

export function installPromoUi(win, doc, deps = {}) {
  const later = deps.setTimeout ?? ((fn, ms) => win.setTimeout(fn, ms));
  let hideTimer = null;

  function toast(text) {
    let el = doc.querySelector("." + TOAST);
    if (!el) {
      el = doc.createElement("div");
      el.className = TOAST;
      el.setAttribute("role", "status");
      el.setAttribute("aria-live", "polite");
      doc.body.appendChild(el);
    }
    if (el.textContent !== text) el.textContent = text;
    el.setAttribute("data-show", "");
    if (hideTimer) clearTimeout(hideTimer);
    hideTimer = later(() => el.removeAttribute("data-show"), TOAST_MS);
  }

  win.addEventListener("message", (e) => {
    const m = e.data;
    if (m?.source === SOURCE && m.type === "promoNotice" && m.text) toast(String(m.text));
  });
}
