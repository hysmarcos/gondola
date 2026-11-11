// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import { installSkin, pageKind, skinReady } from "../src/skin.js";
import { renderPopup } from "../src/popup.js";
import { DOM } from "../src/skin-dom.js";

const html = (f) => readFileSync(`tests/fixtures/dom/${f}.html`, "utf8");
function setup(body, path, stored = {}) {
  const dom = new JSDOM(`<body>${body}</body>`, { url: "https://www.coto.com.ar" + path });
  const listeners = [];
  const storage = { get: async () => stored, onChanged: { addListener: (fn) => listeners.push(fn) } };
  return { win: dom.window, doc: dom.window.document, storage, change: (c) => listeners.forEach((fn) => fn(c)) };
}
const attr = (doc) => doc.documentElement.getAttribute("data-gondola-skin");
const tick = () => new Promise((r) => setTimeout(r, 20));

describe("piel Góndola", () => {
  it("lista: pone el atributo", async () => {
    const t = setup(html("lista"), "/sitios/cdigi/categoria/x");
    installSkin(t.win, t.doc, t.storage);
    await tick();
    expect(attr(t.doc)).toBe("list");
  });
  it("PDP: pone el atributo", async () => {
    const t = setup(html("pdp"), "/sitios/cdigi/productos/leche/_/R-00508911-00508911-200");
    installSkin(t.win, t.doc, t.storage);
    await tick();
    expect(attr(t.doc)).toBe("pdp");
  });
  it("ajuste apagado: no hay atributo", async () => {
    const t = setup(html("lista"), "/x", { skin: false });
    installSkin(t.win, t.doc, t.storage);
    await tick();
    expect(attr(t.doc)).toBeNull();
  });
  it("apagar con la página abierta saca el atributo y avisa una vez", async () => {
    const t = setup(html("lista"), "/x");
    const onChange = vi.fn();
    installSkin(t.win, t.doc, t.storage, onChange);
    await tick();
    onChange.mockClear();
    t.storage.get = async () => ({ skin: false });
    t.change({ skin: { newValue: false } });
    await tick();
    expect(attr(t.doc)).toBeNull();
    expect(onChange).toHaveBeenCalledTimes(1);
  });
  it("PDP sin dibujar todavía: la piel queda prendida", async () => {
    const t = setup("<app-root></app-root>", "/p/_/R-00508911-00508911-200");
    installSkin(t.win, t.doc, t.storage);
    await tick();
    expect(skinReady(t.doc, "pdp")).toBeNull();
    expect(attr(t.doc)).toBe("pdp");
  });
  it("PDP dibujada sin la columna de compra: la piel se apaga", async () => {
    const t = setup(html("pdp"), "/p/_/R-00508911-00508911-200");
    t.doc.querySelector(DOM.pdp.buy).remove();
    // si el precio vivía adentro de la columna, se repone dentro de la página de producto pero fuera de ella
    if (!t.doc.querySelector(DOM.pdp.price)) t.doc.querySelector("app-product-detail").insertAdjacentHTML("beforeend", '<var class="price">$1</var>');
    expect(t.doc.querySelector(DOM.pdp.price)).not.toBeNull();
    expect(t.doc.querySelector(DOM.pdp.buy)).toBeNull();
    installSkin(t.win, t.doc, t.storage);
    await tick();
    expect(attr(t.doc)).toBeNull();
  });
  it("página que no es lista ni PDP: sin atributo", async () => {
    const t = setup("<main>inicio</main>", "/");
    installSkin(t.win, t.doc, t.storage);
    await tick();
    expect(pageKind(t.win, t.doc)).toBeNull();
    expect(attr(t.doc)).toBeNull();
  });
});

describe("popup: ajuste Diseño Góndola", () => {
  const fakeStorage = (data = {}) => ({ data, get: async (keys) => Object.fromEntries(keys.filter((k) => k in data).map((k) => [k, data[k]])), set: async (o) => Object.assign(data, o) });
  it("dibuja un interruptor skin, encendido salvo que esté guardado en false", async () => {
    await renderPopup(document, fakeStorage(), { version: "1" });
    const box = document.querySelector('input[name="skin"]');
    expect(box).not.toBeNull();
    expect(box.checked).toBe(true);
    expect(box.closest("label").textContent).toContain("Diseño Góndola");
    await renderPopup(document, fakeStorage({ skin: false }), { version: "1" });
    expect(document.querySelector('input[name="skin"]').checked).toBe(false);
  });
});
