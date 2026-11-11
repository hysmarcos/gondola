// Interruptor de la piel Góndola: pone o saca data-gondola-skin en <html>. Todo el diseño
// nuevo (src/skin*.css) y las piezas que la piel suma cuelgan de ese atributo.
// Otros módulos lo leen con doc.documentElement.getAttribute("data-gondola-skin").
import { DOM, REQUIRED } from "./skin-dom.js";

const ATTR = "data-gondola-skin";
const KEY_RE = /_\/R-[\w-]+/; // la misma regla de badge.js para reconocer una PDP

// "pdp" | "list" | null
export function pageKind(win, doc) {
  if (KEY_RE.test(String(win.location?.pathname ?? ""))) return "pdp";
  return doc.querySelector(DOM.list.grid) ? "list" : null;
}

// null: Angular todavía no dibujó la página (no hay que apagar la piel por eso).
// true / false: ya se dibujó; true solo si están todos los nodos que el diseño necesita.
export function skinReady(doc, kind) {
  const drawn = kind === "list" ? DOM.list.card : DOM.pdp.price;
  if (!doc.querySelector(drawn)) return null;
  return REQUIRED[kind].every((key) => doc.querySelector(DOM[kind][key]));
}

// storage: { get(keys), onChanged: { addListener(fn) } }. onChange() solo si cambió el atributo.
export function installSkin(win, doc, storage, onChange = () => {}) {
  const root = doc.documentElement;
  let enabled = null; // sin leer el ajuste todavía: no se prende, para no parpadear si está apagado
  let queued = false;

  const decide = () => {
    queued = false;
    const kind = enabled ? pageKind(win, doc) : null;
    const next = kind && skinReady(doc, kind) !== false ? kind : null;
    if (root.getAttribute(ATTR) === next) return;
    if (next) root.setAttribute(ATTR, next);
    else root.removeAttribute(ATTR);
    onChange();
  };

  // Los cambios del DOM llegan en ráfagas: se decide una vez por cuadro.
  const schedule = () => {
    if (queued) return;
    queued = true;
    (win.requestAnimationFrame ?? ((fn) => win.setTimeout(fn, 0)))(decide);
  };

  const load = () =>
    storage.get(["skin"]).then((s) => {
      enabled = s?.skin !== false;
      decide();
    }).catch(() => {});

  storage.onChanged.addListener((changes) => {
    if ("skin" in changes) load();
  });
  new win.MutationObserver(schedule).observe(root, { childList: true, subtree: true });
  win.addEventListener("popstate", schedule);
  load();
}
