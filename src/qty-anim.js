// Contador de cantidad de Coto (− cantidad +): cuando un clic en "−" o "+" cambia el número,
// marca el campo con data-gondola-qty="up" o "down" para que src/skin.css lo anime (el número
// entra desde abajo al sumar y desde arriba al restar). No toca el valor ni los botones.
// Escribir el número a mano no se anima: solo los clics.

export const QTY_ATTR = "data-gondola-qty";

const inputOf = (target) => {
  const btn = target?.closest?.("product-add-show-remove button");
  return btn?.closest("product-add-show-remove")?.querySelector('input[id^="input-prod"]') ?? null;
};

export function installQtyAnim(win, doc) {
  const onClick = (e) => {
    const input = inputOf(e.target);
    if (!input) return;
    const before = Number(input.value);
    // Angular cambia el número durante el clic: se compara en el cuadro siguiente.
    win.requestAnimationFrame(() => {
      const after = Number(input.value);
      if (!input.isConnected || !Number.isFinite(before) || !Number.isFinite(after) || after === before) return;
      // Sacar la marca y leer el ancho reinicia la animación si todavía corría la anterior.
      input.removeAttribute(QTY_ATTR);
      void input.offsetWidth;
      input.setAttribute(QTY_ATTR, after > before ? "up" : "down");
    });
  };
  const onEnd = (e) => {
    if (e.target?.hasAttribute?.(QTY_ATTR)) e.target.removeAttribute(QTY_ATTR);
  };
  doc.addEventListener("click", onClick, true);
  doc.addEventListener("animationend", onEnd, true);
  doc.addEventListener("animationcancel", onEnd, true);
  return () => {
    doc.removeEventListener("click", onClick, true);
    doc.removeEventListener("animationend", onEnd, true);
    doc.removeEventListener("animationcancel", onEnd, true);
  };
}
