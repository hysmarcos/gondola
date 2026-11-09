// Corre en la página (world MAIN). Cuando completamos un 2x1, Angular igual escribe en el
// contador la cantidad que pidió el usuario (ej. 3) hasta que llega el carrito (4). Para que
// nunca se vea el número viejo, durante unos segundos el contador de ese producto cambia
// `from` por `to` en el momento en que Angular lo escribe. Coto le pone id="input-<prodId>".

const KEEP_MS = 4000;
const watchers = new Map(); // prodId → MutationObserver activo

export function pinInput(win, doc, prodId, from, to, { now = Date.now, ms = KEEP_MS } = {}) {
  const proto = win.HTMLInputElement?.prototype;
  const native = proto && Object.getOwnPropertyDescriptor(proto, "value");
  if (!native?.set) return;
  const until = now() + ms;
  const selector = `input[id="input-${prodId}"]`;

  const pin = (input) => {
    input.__cotoPin = { from: String(from), to: String(to), until };
    if (!Object.prototype.hasOwnProperty.call(input, "value")) {
      Object.defineProperty(input, "value", {
        configurable: true,
        get() { return native.get.call(this); },
        set(v) {
          const p = this.__cotoPin;
          const swap = p && now() <= p.until && String(v).trim() === p.from;
          // Cualquier otro valor (llegó el carrito, el usuario tocó "−") suelta la fijación.
          if (p && !swap) this.__cotoPin = null;
          native.set.call(this, swap ? p.to : v);
        },
      });
    }
    // Mientras el usuario escribe no tocamos lo que ve.
    if (doc.activeElement !== input && native.get.call(input).trim() === String(from)) native.set.call(input, String(to));
  };

  watchers.get(prodId)?.disconnect();
  doc.querySelectorAll(selector).forEach(pin);
  // El contador del primer "Agregar" se crea después del clic: solo fijamos los nuevos.
  const seen = new WeakSet(doc.querySelectorAll(selector));
  const observer = new win.MutationObserver(() => {
    for (const input of doc.querySelectorAll(selector)) {
      if (seen.has(input)) continue;
      seen.add(input);
      pin(input);
    }
  });
  observer.observe(doc.documentElement, { childList: true, subtree: true });
  watchers.set(prodId, observer);
  win.setTimeout(() => {
    observer.disconnect();
    if (watchers.get(prodId) === observer) watchers.delete(prodId);
  }, ms);
}

// Un pedido nuevo de ese producto: el usuario siguió tocando, ya no fijamos nada.
export function unpinInput(doc, prodId) {
  watchers.get(prodId)?.disconnect();
  watchers.delete(prodId);
  for (const input of doc.querySelectorAll(`input[id="input-${prodId}"]`)) input.__cotoPin = null;
}
