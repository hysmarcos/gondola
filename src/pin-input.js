// Corre en la página (world MAIN). Cuando completamos un 2x1, Angular igual escribe en el
// contador la cantidad que pidió el usuario (ej. 3) hasta que llega el carrito (4). Para que
// nunca se vea el número viejo, durante unos segundos el contador de ese producto cambia
// `from` por `to` en el momento en que Angular lo escribe. Coto le pone id="input-<prodId>".

const KEEP_MS = 4000;

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
          native.set.call(this, swap ? p.to : v);
        },
      });
    }
    if (native.get.call(input).trim() === String(from)) native.set.call(input, String(to));
  };

  doc.querySelectorAll(selector).forEach(pin);
  // El contador del primer "Agregar" se crea después del clic.
  const observer = new win.MutationObserver(() => doc.querySelectorAll(selector).forEach(pin));
  observer.observe(doc.documentElement, { childList: true, subtree: true });
  win.setTimeout(() => observer.disconnect(), ms);
}
