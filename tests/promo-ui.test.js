// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { installPromoUi } from "../src/promo-ui.js";

const tick = () => new Promise((r) => setTimeout(r, 0));

function setup(html, path = "/productos/categorias/x") {
  const win = new EventTarget();
  win.location = { pathname: path };
  win.requestAnimationFrame = (fn) => setTimeout(fn, 0);
  const env = { time: 0 };
  const doc = document.implementation.createHTMLDocument("x");
  doc.body.innerHTML = html;
  installPromoUi(win, doc, { now: () => env.time, setTimeout: (fn, ms) => setTimeout(fn, ms) });
  const send = (data) => win.dispatchEvent(new MessageEvent("message", { data: { source: "coto-unit", ...data } }));
  return { win, doc, send, env };
}

describe("promoNotice", () => {
  it("muestra un aviso que se va solo", async () => {
    const { doc, send } = setup("");
    send({ type: "promoNotice", text: "Promo 2x1: sumamos 1 gratis" });
    await new Promise((r) => setTimeout(r, 60));
    const toast = doc.querySelector(".coto-unit-toast");
    expect(toast.textContent).toBe("Promo 2x1: sumamos 1 gratis");
    expect(toast.getAttribute("role")).toBe("status");
    await new Promise((r) => setTimeout(r, 3600));
    expect(doc.querySelector(".coto-unit-toast[data-show]")).toBeNull();
  }, 6000);
});
