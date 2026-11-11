// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { renderWelcome } from "../src/welcome.js";
import { renderPopup } from "../src/popup.js";
import { addMenuEntry, installCotoMenu } from "../src/coto-menu.js";
import { openSettings, welcomeOnInstall } from "../src/lifecycle.js";
import { packageFiles } from "../scripts/package-lib.mjs";

const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));

function fakeStorage(initial = {}) {
  const data = { ...initial };
  return { data, get: async (keys) => Object.fromEntries(keys.filter((k) => k in data).map((k) => [k, data[k]])), set: async (o) => Object.assign(data, o) };
}

function fakeChrome({ popupFails = false } = {}) {
  const api = {
    opened: [], popups: 0, data: {},
    runtime: { getURL: (p) => "chrome-extension://id/" + p },
    tabs: { create: (o) => { api.opened.push(o.url); return Promise.resolve(); } },
    storage: { local: { set: async (o) => Object.assign(api.data, o) } },
    action: { openPopup: async () => { if (popupFails) throw new Error("no"); api.popups++; } },
  };
  return api;
}

beforeEach(() => { document.body.innerHTML = ""; });

describe("bienvenida", () => {
  it("se abre al instalar y no al actualizar", () => {
    const api = fakeChrome();
    expect(welcomeOnInstall({ reason: "update" }, api)).toBe(false);
    expect(api.opened).toEqual([]);
    expect(welcomeOnInstall({ reason: "install" }, api)).toBe(true);
    expect(api.opened).toEqual(["chrome-extension://id/welcome.html"]);
  });

  it("explica los pasos, lo que se encuentra y trae el menú real", () => {
    renderWelcome(document, { version: "9.9.9", popupUrl: "popup.html", privacyUrl: "https://p", repoUrl: "https://r" });
    expect(document.querySelector("h1").textContent).toBe("Góndola ya está en tu Chrome");
    expect([...document.querySelectorAll(".steps h3")].map((h) => h.textContent)).toEqual(["Abrí Coto", "Elegí tus tarjetas", "Prendé o apagá lo que quieras", "Cargá tu perfil, si querés"]);
    expect(document.querySelectorAll(".features li")).toHaveLength(6);
    expect(document.querySelector(".steps a.button").href).toBe("https://www.coto.com.ar/");
    expect(document.querySelector("iframe").getAttribute("src")).toBe("popup.html");
    expect(document.body.textContent).toContain("No es consejo médico.");
    expect(document.body.textContent).toContain("Versión 9.9.9");
    // Un solo h1 y los títulos en orden.
    expect(document.querySelectorAll("h1")).toHaveLength(1);
  });

  it("va en el paquete y el HTML carga su script y su estilo", () => {
    expect(packageFiles(["welcome.html", "dist/welcome.js", "src/welcome.css", "src/welcome.js"])).toEqual(["dist/welcome.js", "src/welcome.css", "welcome.html"]);
    const html = readFileSync("welcome.html", "utf8");
    expect(html).toContain('src="dist/welcome.js"');
    expect(html).toContain('href="src/welcome.css"');
    expect(readFileSync("build.mjs", "utf8")).toContain("dist/welcome.js");
  });
});

describe("popup: tamaño fijo y ajustes por secciones", () => {
  it("el cuerpo tiene ancho y alto fijos, y el contenido es lo que se desplaza", () => {
    const css = readFileSync("src/popup.css", "utf8");
    const body = css.match(/\nbody \{[^}]*width: 360px;[^}]*\}/)?.[0] ?? "";
    expect(body).toContain("height: 580px;");
    expect(body).toContain("overflow: hidden;");
    expect(body).not.toContain("max-height");
    expect(css).toMatch(/main \{[^}]*min-height: 0;[^}]*overflow-y: auto;/);
  });

  it("Ajustes muestra un menú de secciones con ícono y estado", async () => {
    await renderPopup(document, fakeStorage({ markBest: false }), { version: "1" });
    const rows = [...document.querySelectorAll('[data-view="ajustes"] .menu-row')];
    expect(rows.map((r) => r.querySelector(".menu-title").textContent)).toEqual(["Apariencia", "Precios y promos", "Comparar y nutrición", "Mi perfil"]);
    for (const r of rows) expect(r.querySelector(".menu-icon svg")).not.toBeNull();
    expect(rows.map((r) => r.querySelector(".menu-status").textContent)).toEqual(["1 de 2 prendidos", "3 de 3 prendidos", "2 de 2 prendidos", "Sin cargar"]);
    // Todas las pantallas empiezan cerradas.
    expect(document.querySelectorAll(".screen:not([hidden])")).toHaveLength(0);
  });

  it("una fila abre su pantalla, 'Ajustes' vuelve, y el estado se actualiza", async () => {
    const st = fakeStorage({ popupTab: "ajustes" });
    await renderPopup(document, st, { version: "1" });
    const row = document.querySelector('.menu-row[data-section="perfil"]');
    row.click();
    const screen = document.querySelector('.screen[data-section="perfil"]');
    expect(screen.hidden).toBe(false);
    expect(document.querySelector(".menu").hidden).toBe(true);
    expect(document.activeElement).toBe(screen.querySelector(".back"));
    screen.querySelector('input[name="profileCeliac"]').click();
    screen.querySelector('input[name="profileAllergens"][value="milk"]').click();
    await tick();
    expect(st.data.profileCeliac).toBe(true);
    screen.querySelector(".back").click();
    expect(screen.hidden).toBe(true);
    expect(document.querySelector(".menu").hidden).toBe(false);
    expect(document.activeElement).toBe(row);
    expect(row.querySelector(".menu-status").textContent).toBe("1 cuidado · 1 alergia");
  });

  it("cada ajuste está en una sola sección", async () => {
    await renderPopup(document, fakeStorage(), { version: "1" });
    const where = (name) => [...document.querySelectorAll(`input[name="${name}"]`)].map((i) => i.closest(".screen").dataset.section);
    expect(where("skin")).toEqual(["apariencia"]);
    expect(where("markBest")).toEqual(["apariencia"]);
    expect(where("comunidad")).toEqual(["precios"]);
    expect(where("autoPromo")).toEqual(["precios"]);
    expect(where("notifyPromo")).toEqual(["precios"]);
    expect(where("compareStores")).toEqual(["datos"]);
    expect(where("nutrition")).toEqual(["datos"]);
    expect(where("profileSodium")).toEqual(["perfil"]);
  });

  it("meta.section abre el popup en esa sección de Ajustes", async () => {
    await renderPopup(document, fakeStorage({ popupTab: "ayuda" }), { version: "1", section: "datos" });
    expect(document.querySelector('[role="tabpanel"]:not([hidden])').dataset.view).toBe("ajustes");
    expect(document.querySelector(".screen:not([hidden])").dataset.section).toBe("datos");
  });

  it("Ayuda tiene el link a la bienvenida", async () => {
    await renderPopup(document, fakeStorage(), { version: "1", welcomeUrl: "welcome.html" });
    expect(document.querySelector(".welcome-link a").getAttribute("href")).toBe("welcome.html");
  });
});

describe("abrir los ajustes desde Coto", () => {
  it("abre el popup en Ajustes", async () => {
    const api = fakeChrome();
    expect(await openSettings(api)).toBe("popup");
    expect(api.data.popupTab).toBe("ajustes");
    expect(api.popups).toBe(1);
    expect(api.opened).toEqual([]);
  });

  it("si Chrome no deja abrir el popup, abre el menú como página", async () => {
    const api = fakeChrome({ popupFails: true });
    expect(await openSettings(api)).toBe("tab");
    expect(api.opened).toEqual(["chrome-extension://id/popup.html?page=1&tab=ajustes"]);
  });
});

describe("menú de perfil de Coto", () => {
  // Dos formas posibles del menú: lista con links, y divs sueltos con un separador.
  const LIST = `<div class="dropdown"><p>Hola Marcos</p><a class="cuenta" href="/cuenta">Mi cuenta</a><ul class="ops">
    <li class="op"><a class="op-link" href="/h"><i></i> Horarios de entrega</a></li>
    <li class="op"><a class="op-link" href="/p"><i></i> Mis Pedidos</a></li>
    <li class="op"><a class="op-link" href="/l"><i></i> Mis Listas</a></li>
    </ul><hr><a class="salir" href="#">Cerrar sesión</a></div>`;
  const DIVS = `<div class="menu-user"><div class="grupo">
    <a class="item" href="/h"><span>Horarios de entrega</span></a>
    <a class="item" href="/p"><span>Mis Pedidos</span></a>
    <a class="item" href="/l"><span>Mis Listas</span></a></div>
    <div class="grupo"><a class="item" href="#"><span>Cerrar sesión</span></a></div></div>`;
  let opened;
  const opts = { iconUrl: "icon.svg", onOpen: () => opened++ };
  beforeEach(() => { opened = 0; });

  it("agrega la entrada después de 'Mis Listas', con la forma de las filas de Coto", () => {
    document.body.innerHTML = LIST;
    const before = document.querySelector(".ops").children.length;
    expect(addMenuEntry(document, opts)).toBe(true);
    const row = document.querySelector("[data-gondola-menu]");
    expect(row.tagName).toBe("LI");
    expect(row.className).toBe("op");
    expect(row.previousElementSibling.textContent).toContain("Mis Listas");
    expect(row.querySelector("a").classList.contains("op-link")).toBe(true);
    expect(row.textContent).toBe("Configurar Góndola");
    expect(row.querySelector("img").getAttribute("src")).toBe("icon.svg");
    expect(row.querySelector("img").alt).toBe("");
    // Solo agrega: las filas de Coto siguen todas, sin cambios.
    expect(document.querySelector(".ops").children.length).toBe(before + 1);
    expect(document.querySelector(".salir").textContent).toBe("Cerrar sesión");
  });

  it("no la agrega dos veces", () => {
    document.body.innerHTML = LIST;
    addMenuEntry(document, opts);
    expect(addMenuEntry(document, opts)).toBe(false);
    expect(document.querySelectorAll("[data-gondola-menu]")).toHaveLength(1);
  });

  it("funciona cuando la fila es el link mismo", () => {
    document.body.innerHTML = DIVS;
    expect(addMenuEntry(document, opts)).toBe(true);
    const row = document.querySelector("[data-gondola-menu]");
    expect(row.tagName).toBe("A");
    expect(row.className).toContain("item");
    expect(row.parentElement.className).toBe("grupo");
    expect(row.previousElementSibling.textContent).toBe("Mis Listas");
  });

  it("el clic abre los ajustes y no navega", () => {
    document.body.innerHTML = LIST;
    addMenuEntry(document, opts);
    const ev = new MouseEvent("click", { bubbles: true, cancelable: true });
    document.querySelector("[data-gondola-menu] a").dispatchEvent(ev);
    expect(opened).toBe(1);
    expect(ev.defaultPrevented).toBe(true);
  });

  it("sin el menú (sin sesión) no agrega nada", () => {
    document.body.innerHTML = `<header><button>Ingresar</button></header><a href="/l">Mis Listas</a>`;
    expect(addMenuEntry(document, opts)).toBe(false);
    expect(document.querySelector("[data-gondola-menu]")).toBeNull();
  });

  it("mira después de un clic en la página", async () => {
    installCotoMenu(window, document, opts);
    document.body.innerHTML = LIST;
    document.body.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await tick(200);
    expect(document.querySelectorAll("[data-gondola-menu]")).toHaveLength(1);
  });
});
