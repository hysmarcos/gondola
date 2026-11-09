// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { pinInput } from "../src/pin-input.js";

const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));
const stepper = (id, v) => `<product-add-show-remove><input id="input-${id}" value="${v}"></product-add-show-remove>`;

describe("pinInput", () => {
  it("cuando Angular escribe la cantidad vieja, queda la nueva", async () => {
    document.body.innerHTML = stepper("prod00000777", "2");
    const env = { t: 0 };
    pinInput(window, document, "prod00000777", 3, 4, { now: () => env.t });
    const input = document.getElementById("input-prod00000777");
    input.value = "3"; // lo que escribe Angular después del clic
    expect(input.value).toBe("4");
    input.value = "5"; // otros valores pasan
    expect(input.value).toBe("5");
  });

  it("también fija el contador que aparece después (primer agregado)", async () => {
    document.body.innerHTML = `<div id="slot"></div>`;
    pinInput(window, document, "prod00000777", 1, 2, { now: () => 0 });
    document.getElementById("slot").innerHTML = stepper("prod00000777", "");
    await tick();
    const input = document.getElementById("input-prod00000777");
    input.value = "1";
    expect(input.value).toBe("2");
  });

  it("pasado el tiempo deja de tocar", async () => {
    document.body.innerHTML = stepper("prod00000777", "2");
    const env = { t: 0 };
    pinInput(window, document, "prod00000777", 3, 4, { now: () => env.t, ms: 10 });
    env.t = 50;
    const input = document.getElementById("input-prod00000777");
    input.value = "3";
    expect(input.value).toBe("3");
  });

  it("no toca otros productos", () => {
    document.body.innerHTML = stepper("prod00000777", "1") + stepper("prod00000888", "1");
    pinInput(window, document, "prod00000777", 1, 2, { now: () => 0 });
    const other = document.getElementById("input-prod00000888");
    other.value = "1";
    expect(other.value).toBe("1");
    expect(document.getElementById("input-prod00000777").value).toBe("2");
  });
});
