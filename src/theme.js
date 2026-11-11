// Interruptor del tema Góndola: pone o saca data-gondola-theme="dark" en <html>. El CSS oscuro
// (src/theme.css) cuelga de ese atributo; en claro el atributo no existe.
// El último tema se guarda en localStorage para pintarlo antes del primer cuadro, sin parpadeo.
export const THEME_ATTR = "data-gondola-theme";
export const THEME_CACHE_KEY = "gondola-theme";
export const WAVE_CLASS = "gondola-theme-wave";

const DARK_QUERY = "(prefers-color-scheme: dark)";
const MOTION_QUERY = "(prefers-reduced-motion: reduce)";

// "light" | "dark" | "auto"; cualquier otro valor, o ninguno, vale "light".
export function normalizeTheme(setting) {
  return setting === "dark" || setting === "auto" ? setting : "light";
}

// "dark" | "light": "auto" sigue al sistema.
export function resolveTheme(setting, systemDark) {
  const theme = normalizeTheme(setting);
  if (theme === "auto") return systemDark ? "dark" : "light";
  return theme;
}

// storage: { get(keys), onChanged: { addListener(fn) } }.
export function installTheme(win, doc, storage) {
  const root = doc.documentElement;
  let setting = "light";
  let lastWave = null; // la última transición lanzada: solo ella saca la clase de la onda

  const systemDark = () => {
    try { return Boolean(win.matchMedia(DARK_QUERY).matches); } catch { return false; }
  };
  const waveAllowed = () => {
    if (typeof doc.startViewTransition !== "function" || doc.hidden) return false;
    try { return !win.matchMedia(MOTION_QUERY).matches; } catch { return true; }
  };
  const setAttr = (theme) => {
    if (theme === "dark") root.setAttribute(THEME_ATTR, "dark");
    else root.removeAttribute(THEME_ATTR);
  };

  const apply = (theme, animate) => {
    try { win.localStorage.setItem(THEME_CACHE_KEY, theme); } catch {}
    if ((root.getAttribute(THEME_ATTR) === "dark") === (theme === "dark")) return;
    if (!(animate && waveAllowed())) return setAttr(theme);
    root.classList.add(WAVE_CLASS);
    const transition = doc.startViewTransition(() => setAttr(theme));
    lastWave = transition;
    Promise.resolve(transition?.finished)
      .catch(() => {})
      .finally(() => {
        if (lastWave === transition) root.classList.remove(WAVE_CLASS);
      });
  };

  // Lo que quedó guardado se aplica ya, de forma síncrona; después se lee el ajuste real.
  try { setAttr(win.localStorage.getItem(THEME_CACHE_KEY) === "dark" ? "dark" : "light"); } catch {}

  const load = (animate) =>
    storage.get(["theme"]).then((s) => {
      setting = normalizeTheme(s?.theme);
      apply(resolveTheme(setting, systemDark()), animate);
    }).catch(() => {});

  storage.onChanged.addListener((changes) => {
    if ("theme" in changes) load(true);
  });
  try {
    win.matchMedia(DARK_QUERY).addEventListener("change", () => {
      if (setting === "auto") apply(resolveTheme(setting, systemDark()), true);
    });
  } catch {}
  load(false);
}
