// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { installPromoClicks } from "../src/promo-clicks.js";

const TWO = { discounts: [{ discountText: "2x1", takingText: "Llevando 2", discountPrice: "$1" }] };
const THREE = { discounts: [{ discountText: "3x2", takingText: "Llevando 3", discountPrice: "$1" }] };

// Imita el contador de Coto: "+" suma 1 al instante y avisa por cada clic.
function stepper(id, value) {
  document.body.insertAdjacentHTML("beforeend", `<product-add-show-remove><div class="input-group">
    <button type="button" class="minus">-</button><input id="input-${id}" value="${value}"><button type="button" class="plus">+</button></div></product-add-show-remove>`);
  const input = document.getElementById(`input-${id}`);
  const clicks = [];
  input.nextElementSibling.addEventListener("click", () => { input.value = String(Number(input.value) + 1); clicks.push(input.value); });
  input.previousElementSibling.addEventListener("click", () => { input.value = String(Number(input.value) - 1); clicks.push(input.value); });
  return { input, plus: input.nextElementSibling, minus: input.previousElementSibling, clicks };
}

function setup(data, enabled = true) {
  document.body.innerHTML = "";
  const notices = [];
  const off = installPromoClicks(window, document, {
    dataFor: (id) => data[id] ?? null,
    enabled: () => enabled,
    notify: (prodId, text) => notices.push(text),
  });
  return { notices, off };
}

describe("installPromoClicks", () => {
  it("2x1: al pasar de 2 a 3 suma otro clic al instante", () => {
    const { notices, off } = setup({ prod1: TWO });
    const s = stepper("prod1", "2");
    s.plus.click();
    expect(s.input.value).toBe("4");
    expect(s.clicks).toEqual(["3", "4"]);
    expect(notices).toEqual(["Promo 2x1: sumamos 1 gratis"]);
    off();
  });

  it("3x2: de 1 a 2 suma el tercero; de 0 a 1 no", () => {
    const { off } = setup({ prod1: THREE });
    const s = stepper("prod1", "1");
    s.plus.click();
    expect(s.input.value).toBe("3");
    s.plus.click();
    expect(s.input.value).toBe("4");
    off();
  });

  it("restar nunca agrega", () => {
    const { off } = setup({ prod1: TWO });
    const s = stepper("prod1", "4");
    s.minus.click();
    expect(s.input.value).toBe("3");
    off();
  });

  it("sin datos del producto o apagado, no hace nada", () => {
    let t = setup({});
    let s = stepper("prod1", "2");
    s.plus.click();
    expect(s.input.value).toBe("3");
    t.off();
    t = setup({ prod1: TWO }, false);
    s = stepper("prod1", "2");
    s.plus.click();
    expect(s.input.value).toBe("3");
    t.off();
  });
});

describe("revisión v4: promo-clicks avisa la cantidad final", () => {
  it("llama a expect con el valor que dejó en el contador", () => {
    document.body.innerHTML = "";
    const expected = [];
    const off = installPromoClicks(window, document, { dataFor: () => TWO, enabled: () => true, expect: (id, q) => expected.push([id, q]) });
    const s = stepper("prod1", "2");
    s.plus.click();
    expect(expected).toEqual([["prod1", 4]]);
    off();
  });
});
