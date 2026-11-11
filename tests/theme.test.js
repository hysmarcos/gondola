// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { JSDOM } from "jsdom";
import { installTheme, resolveTheme, normalizeTheme } from "../src/theme.js";

function setup(stored = {}, { systemDark = false, cache, reducedMotion = false, hidden = false, viewTransitions = false, brokenLocalStorage = false, slowFinish = false } = {}) {
  const dom = new JSDOM("<body></body>", { url: "https://www.coto.com.ar/" });
  const win = dom.window;
  const doc = win.document;
  const listeners = [];
  const mediaListeners = [];
  const storage = { get: vi.fn(async () => stored), onChanged: { addListener: (fn) => listeners.push(fn) } };
  win.matchMedia = (q) => {
    const matches = q.includes("prefers-reduced-motion") ? reducedMotion : systemDark;
    return { matches, addEventListener: (_t, fn) => { if (q.includes("prefers-color-scheme")) mediaListeners.push(fn); } };
  };
  Object.defineProperty(doc, "hidden", { value: hidden, configurable: true });
  const finishers = [];
  if (viewTransitions) {
    doc.startViewTransition = vi.fn((cb) => {
      cb();
      if (!slowFinish) return { finished: Promise.resolve() };
      return { finished: new Promise((r) => finishers.push(r)) };
    });
  }
  if (brokenLocalStorage) {
    Object.defineProperty(win, "localStorage", {
      value: { getItem() { throw new Error("x"); }, setItem() { throw new Error("x"); } },
      configurable: true,
    });
  } else if (cache) {
    win.localStorage.setItem("gondola-theme", cache);
  }
  return {
    win, doc, storage, finishers,
    change: (c) => listeners.forEach((fn) => fn(c)),
    systemChange: () => mediaListeners.forEach((fn) => fn({})),
  };
}
const attr = (doc) => doc.documentElement.getAttribute("data-gondola-theme");
const wave = (doc) => doc.documentElement.classList.contains("gondola-theme-wave");
const tick = () => new Promise((r) => setTimeout(r, 20));

describe("normalizeTheme", () => {
  it.each([
    ["light", "light"], ["dark", "dark"], ["auto", "auto"],
    [undefined, "light"], [null, "light"], [true, "light"], ["DARK", "light"], ["", "light"],
  ])("%s → %s", (setting, out) => {
    expect(normalizeTheme(setting)).toBe(out);
  });
});

describe("resolveTheme", () => {
  it.each([
    ["dark", false, "dark"], ["dark", true, "dark"],
    ["light", true, "light"], ["auto", true, "dark"], ["auto", false, "light"],
    [undefined, true, "light"], [true, true, "light"], ["DARK", true, "light"], [null, true, "light"],
  ])("%s con sistema oscuro=%s → %s", (setting, systemDark, out) => {
    expect(resolveTheme(setting, systemDark)).toBe(out);
  });
});

describe("installTheme", () => {
  it("theme dark: pone el atributo y guarda la caché", async () => {
    const t = setup({ theme: "dark" });
    installTheme(t.win, t.doc, t.storage);
    await tick();
    expect(attr(t.doc)).toBe("dark");
    expect(t.win.localStorage.getItem("gondola-theme")).toBe("dark");
  });
  it("sin ajuste: sin atributo y caché en light", async () => {
    const t = setup({});
    installTheme(t.win, t.doc, t.storage);
    await tick();
    expect(attr(t.doc)).toBeNull();
    expect(t.win.localStorage.getItem("gondola-theme")).toBe("light");
  });
  it("caché dark: el atributo está puesto de inmediato", () => {
    const t = setup({ theme: "dark" }, { cache: "dark" });
    installTheme(t.win, t.doc, t.storage);
    expect(attr(t.doc)).toBe("dark");
  });
  it("caché dark y ajuste light: se saca el atributo sin onda", async () => {
    const t = setup({ theme: "light" }, { cache: "dark", viewTransitions: true });
    installTheme(t.win, t.doc, t.storage);
    await tick();
    expect(attr(t.doc)).toBeNull();
    expect(t.doc.startViewTransition).not.toHaveBeenCalled();
  });
  it("carga inicial con dark: sin onda", async () => {
    const t = setup({ theme: "dark" }, { viewTransitions: true });
    installTheme(t.win, t.doc, t.storage);
    await tick();
    expect(attr(t.doc)).toBe("dark");
    expect(t.doc.startViewTransition).not.toHaveBeenCalled();
  });
  it("cambio con la página abierta: onda y la clase se saca al terminar", async () => {
    const t = setup({}, { viewTransitions: true });
    installTheme(t.win, t.doc, t.storage);
    await tick();
    t.storage.get.mockImplementation(async () => ({ theme: "dark" }));
    t.change({ theme: { newValue: "dark" } });
    await tick();
    expect(t.doc.startViewTransition).toHaveBeenCalledTimes(1);
    expect(attr(t.doc)).toBe("dark");
    expect(wave(t.doc)).toBe(false);
  });
  it.each([
    ["movimiento reducido", { reducedMotion: true, viewTransitions: true }],
    ["pestaña oculta", { hidden: true, viewTransitions: true }],
    ["sin View Transitions", {}],
  ])("cambio con %s: sin onda", async (_n, opts) => {
    const t = setup({}, opts);
    installTheme(t.win, t.doc, t.storage);
    await tick();
    t.storage.get.mockImplementation(async () => ({ theme: "dark" }));
    t.change({ theme: { newValue: "dark" } });
    await tick();
    expect(attr(t.doc)).toBe("dark");
    if (t.doc.startViewTransition) expect(t.doc.startViewTransition).not.toHaveBeenCalled();
  });
  it("auto: sigue al sistema", async () => {
    const t = setup({ theme: "auto" });
    installTheme(t.win, t.doc, t.storage);
    await tick();
    expect(attr(t.doc)).toBeNull();
    t.win.matchMedia = () => ({ matches: true, addEventListener() {} });
    t.systemChange();
    expect(attr(t.doc)).toBe("dark");
  });
  it("light: el sistema no lo mueve", async () => {
    const t = setup({ theme: "light" });
    installTheme(t.win, t.doc, t.storage);
    await tick();
    t.win.matchMedia = () => ({ matches: true, addEventListener() {} });
    t.systemChange();
    expect(attr(t.doc)).toBeNull();
  });
  it("un cambio de otra clave no relee el storage", async () => {
    const t = setup({});
    installTheme(t.win, t.doc, t.storage);
    await tick();
    t.storage.get.mockClear();
    t.change({ skin: { newValue: false } });
    expect(t.storage.get).not.toHaveBeenCalled();
  });
  it("dos cambios seguidos: queda claro y sin la clase de la onda", async () => {
    const t = setup({}, { viewTransitions: true, slowFinish: true });
    installTheme(t.win, t.doc, t.storage);
    await tick();
    t.storage.get.mockImplementation(async () => ({ theme: "dark" }));
    t.change({ theme: { newValue: "dark" } });
    await tick();
    t.storage.get.mockImplementation(async () => ({ theme: "light" }));
    t.change({ theme: { newValue: "light" } });
    await tick();
    expect(t.finishers).toHaveLength(2);
    t.finishers[1]();
    await tick();
    t.finishers[0]();
    await tick();
    expect(attr(t.doc)).toBeNull();
    expect(wave(t.doc)).toBe(false);
  });
  it("localStorage roto: no tira y aplica el ajuste", async () => {
    const t = setup({ theme: "dark" }, { brokenLocalStorage: true });
    expect(() => installTheme(t.win, t.doc, t.storage)).not.toThrow();
    await tick();
    expect(attr(t.doc)).toBe("dark");
  });
  it("storage.get rechaza: sin atributo y sin error", async () => {
    const t = setup({});
    t.storage.get.mockImplementation(() => Promise.reject(new Error("x")));
    expect(() => installTheme(t.win, t.doc, t.storage)).not.toThrow();
    await tick();
    expect(attr(t.doc)).toBeNull();
  });
});
