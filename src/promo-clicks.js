// Corre en la página (world MAIN). Coto suma 1 al tocar "+" y manda el pedido medio
// segundo después. Si ese clic completa las unidades pagas de un 2x1/3x2, tocamos "+" otra
// vez en el mismo instante: el contador pasa directo (2 → 4) y sale un solo pedido.
import { parseNxM, adjustQty, promoNotice } from "./promo.js";

// deps: { dataFor(prodId) → data | null, enabled() → bool, notify(prodId, text), expect(prodId, qty) }
export function installPromoClicks(win, doc, deps) {
  let before = null; // { input, value } tomado antes de que Angular sume
  let busy = false;

  const plusOf = (target) => {
    const btn = target?.closest?.("product-add-show-remove button");
    const input = btn?.closest("product-add-show-remove")?.querySelector('input[id^="input-prod"]');
    return input && btn === input.nextElementSibling ? { btn, input } : null;
  };

  const capture = (e) => {
    if (busy) return;
    const hit = plusOf(e.target);
    before = hit ? { input: hit.input, value: Number(hit.input.value) } : null;
  };

  const bubble = (e) => {
    if (busy || !before) return;
    const hit = plusOf(e.target);
    const prev = before;
    before = null;
    if (!hit || hit.input !== prev.input || !deps.enabled()) return;
    const prodId = hit.input.id.slice("input-".length);
    const data = deps.dataFor(prodId);
    const now = Number(hit.input.value);
    const want = adjustQty(prev.value, now, parseNxM(data));
    if (!(want > now) || !Number.isFinite(prev.value)) return;
    busy = true;
    try {
      // .click() no sirve acá: el navegador lo ignora mientras dura el clic original.
      for (let i = now; i < want; i++) {
        hit.btn.dispatchEvent(new win.MouseEvent("click", { bubbles: true, cancelable: true }));
      }
    } finally {
      busy = false;
    }
    deps.expect?.(prodId, want);
    const text = promoNotice(data, want, want - now);
    if (text) deps.notify?.(prodId, text);
  };

  doc.addEventListener("click", capture, true);
  doc.addEventListener("click", bubble, false);
  return () => {
    doc.removeEventListener("click", capture, true);
    doc.removeEventListener("click", bubble, false);
  };
}
