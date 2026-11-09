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

const card = (plu, qty) => `<div class="card-container"><a href="/productos/x/_/R-${plu}-${plu}-200">x</a>
  <product-add-show-remove><button>-</button><input type="text" value="${qty}"><button>+</button></product-add-show-remove></div>`;

describe("promoAdjust", () => {
  it("pone la cantidad nueva en el contador del producto al instante", async () => {
    const { doc, send } = setup(card("00000777", 1) + card("00000888", 1));
    send({ type: "promoAdjust", prodId: "prod00000777", from: 1, quantity: 2 });
    await tick();
    const [a, b] = doc.querySelectorAll("input");
    expect(a.value).toBe("2");
    expect(b.value).toBe("1");
  });

  it("también corrige el contador que Angular dibuja después", async () => {
    const { doc, send } = setup(`<div class="card-container"><a href="/productos/x/_/R-00000777-00000777-200">x</a></div>`);
    send({ type: "promoAdjust", prodId: "prod00000777", from: 1, quantity: 2 });
    await tick();
    doc.querySelector(".card-container").insertAdjacentHTML("beforeend", `<product-add-show-remove><input value="1"></product-add-show-remove>`);
    await tick(); await tick();
    expect(doc.querySelector("input").value).toBe("2");
  });

  it("en la página de producto usa el producto de la URL", async () => {
    const { doc, send } = setup(`<product-add-show-remove><input value="1"></product-add-show-remove>`, "/productos/aderezo/_/R-00000777-00000777-200");
    send({ type: "promoAdjust", prodId: "prod00000777", from: 1, quantity: 2 });
    await tick();
    expect(doc.querySelector("input").value).toBe("2");
  });

  it("en el carrusel usa el id de la tarjeta", async () => {
    const { doc, send } = setup(`<div class="mini-product-card" data-cnstrc-item-id="prod00000777"><product-add-show-remove><input value="1"></product-add-show-remove></div>`);
    send({ type: "promoAdjust", prodId: "prod00000777", from: 1, quantity: 2 });
    await tick();
    expect(doc.querySelector("input").value).toBe("2");
  });

  it("pasado el tiempo deja de corregir", async () => {
    const { doc, send, env } = setup(card("00000777", 1));
    send({ type: "promoAdjust", prodId: "prod00000777", from: 1, quantity: 2 });
    await tick();
    env.time = 10_000;
    doc.querySelector("input").value = "1";
    await tick(); await tick();
    expect(doc.querySelector("input").value).toBe("1");
  });
});

describe("promoNotice", () => {
  it("muestra un aviso que se va solo", async () => {
    const { doc, send } = setup("");
    send({ type: "promoNotice", text: "Promo 2x1: sumamos 1 gratis" });
    await tick();
    const toast = doc.querySelector(".coto-unit-toast");
    expect(toast.textContent).toBe("Promo 2x1: sumamos 1 gratis");
    expect(toast.getAttribute("role")).toBe("status");
    await new Promise((r) => setTimeout(r, 3600));
    expect(doc.querySelector(".coto-unit-toast[data-show]")).toBeNull();
  }, 6000);
});
