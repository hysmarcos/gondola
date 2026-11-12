// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { installQtyAnim, QTY_ATTR } from "../src/qty-anim.js";

// Un requestAnimationFrame a mano: las funciones corren cuando la prueba llama a flush().
function fakeWin() {
  const queue = [];
  return { requestAnimationFrame: (fn) => queue.push(fn), flush: () => queue.splice(0).forEach((fn) => fn()) };
}

function mount() {
  document.body.innerHTML = `
    <product-add-show-remove>
      <div><button id="menos">-</button><input id="input-prod1" value="2"><button id="mas">+</button></div>
    </product-add-show-remove>
    <button id="otro">otro</button>`;
  return document.getElementById("input-prod1");
}

// El clic de la prueba hace lo que hace Angular: cambia el valor durante el clic.
function click(id, input, value) {
  const btn = document.getElementById(id);
  const set = () => { if (value !== undefined) input.value = value; };
  btn.addEventListener("click", set, { once: true });
  btn.click();
  btn.removeEventListener("click", set);
}

describe("installQtyAnim", () => {
  let win, input, off;
  beforeEach(() => {
    off?.();
    win = fakeWin();
    input = mount();
    off = installQtyAnim(win, document);
  });

  it("marca up cuando el clic sube el número", () => {
    click("mas", input, "3");
    win.flush();
    expect(input.getAttribute(QTY_ATTR)).toBe("up");
  });

  it("marca down cuando el clic baja el número", () => {
    click("menos", input, "1");
    win.flush();
    expect(input.getAttribute(QTY_ATTR)).toBe("down");
  });

  it("no marca nada si el número no cambió", () => {
    click("mas", input);
    win.flush();
    expect(input.hasAttribute(QTY_ATTR)).toBe(false);
  });

  it("ignora los clics fuera del contador", () => {
    click("otro", input, "9");
    win.flush();
    expect(input.hasAttribute(QTY_ATTR)).toBe(false);
  });

  it("saca la marca cuando termina la animación", () => {
    click("mas", input, "3");
    win.flush();
    input.dispatchEvent(new Event("animationend", { bubbles: true }));
    expect(input.hasAttribute(QTY_ATTR)).toBe(false);
  });

  it("al desinstalar deja de marcar", () => {
    off();
    click("mas", input, "3");
    win.flush();
    expect(input.hasAttribute(QTY_ATTR)).toBe(false);
  });
});
