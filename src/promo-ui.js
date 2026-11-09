// Promos por cantidad en pantalla: cuando el intermediario completó un 2x1/3x2, pone la
// cantidad nueva en el contador del producto al instante (Angular la confirma cuando
// llega el carrito) y muestra un aviso breve. Solo cambia el valor visible del contador.

const SOURCE = "coto-unit";
const TOAST = "coto-unit-toast";
const KEEP_MS = 4000;
const TOAST_MS = 3500;

const pluOf = (prodId) => String(prodId ?? "").match(/(\d+)/)?.[1] ?? null;

export function installPromoUi(win, doc, deps = {}) {
  const now = deps.now ?? Date.now;
  const later = deps.setTimeout ?? ((fn, ms) => win.setTimeout(fn, ms));
  const frame = (fn) => (win.requestAnimationFrame ? win.requestAnimationFrame(fn) : later(fn, 16));
  const pending = new Map(); // prodId → { from, to, until }
  let looping = false;
  let hideTimer = null;

  // Contenedores donde vive el contador de ese producto.
  function scopes(prodId) {
    const plu = pluOf(prodId);
    const out = [...doc.querySelectorAll(`.mini-product-card[data-cnstrc-item-id="${prodId}"]`)];
    if (plu) {
      for (const a of doc.querySelectorAll(`a[href*="R-${plu}-"]`)) {
        const card = a.closest(".card-container, card-product-float, card-product");
        if (card) out.push(card);
      }
      if (String(win.location?.pathname ?? "").includes(`R-${plu}-`)) {
        const main = doc.querySelector("product-add-show-remove")?.parentElement;
        if (main) out.push(main);
      }
    }
    return out;
  }

  function apply() {
    const t = now();
    for (const [prodId, p] of pending) {
      if (t > p.until) {
        pending.delete(prodId);
        continue;
      }
      for (const scope of scopes(prodId)) {
        for (const input of scope.querySelectorAll("product-add-show-remove input, input")) {
          if (input.value.trim() === String(p.from)) input.value = String(p.to);
        }
      }
    }
  }

  function loop() {
    apply();
    if (pending.size) frame(loop);
    else looping = false;
  }

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
    if (m?.source !== SOURCE) return;
    if (m.type === "promoAdjust" && m.prodId && Number(m.quantity) > 0) {
      pending.set(m.prodId, { from: Number(m.from), to: Number(m.quantity), until: now() + KEEP_MS });
      apply();
      if (!looping) {
        looping = true;
        frame(loop);
      }
    } else if (m.type === "promoNotice" && m.text) {
      toast(String(m.text));
    }
  });
}
