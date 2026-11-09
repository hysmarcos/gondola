import { describe, it, expect } from "vitest";
import { parseNxM, adjustQty, promoNotice } from "../src/promo.js";

const withPromo = (discountText, takingText = "") => ({ discounts: [{ discountText, takingText, discountPrice: "$100" }] });

describe("parseNxM", () => {
  it("lee 2x1, 3x2, 6x4", () => {
    expect(parseNxM(withPromo("2x1", "Llevando 2"))).toEqual({ n: 2, m: 1 });
    expect(parseNxM(withPromo("3x2"))).toEqual({ n: 3, m: 2 });
    expect(parseNxM(withPromo(" 6 x 4 "))).toEqual({ n: 6, m: 4 });
  });
  it("ignora lo que no es NxM", () => {
    expect(parseNxM(withPromo("70% 2da", "Llevando 2"))).toBeNull();
    expect(parseNxM(withPromo("30%Dto"))).toBeNull();
    expect(parseNxM(withPromo("1x2"))).toBeNull();
    expect(parseNxM({})).toBeNull();
  });
});

describe("adjustQty", () => {
  const two = { n: 2, m: 1 };
  const three = { n: 3, m: 2 };
  const six = { n: 6, m: 4 };
  it("2x1: al agregar 1 pone 2, al pasar a 3 pone 4", () => {
    expect(adjustQty(0, 1, two)).toBe(2);
    expect(adjustQty(2, 3, two)).toBe(4);
  });
  it("3x2: con 1 queda 1, con 2 suma el gratis", () => {
    expect(adjustQty(0, 1, three)).toBe(1);
    expect(adjustQty(1, 2, three)).toBe(3);
    expect(adjustQty(3, 5, three)).toBe(6);
  });
  it("6x4: al llegar a 4 pone 6", () => {
    expect(adjustQty(3, 4, six)).toBe(6);
    expect(adjustQty(0, 3, six)).toBe(3);
  });
  it("nunca toca una baja ni un borrado", () => {
    expect(adjustQty(2, 1, two)).toBe(1);
    expect(adjustQty(2, 0, two)).toBe(0);
    expect(adjustQty(2, -2, two)).toBe(-2);
  });
  it("sin promo no cambia", () => {
    expect(adjustQty(0, 1, null)).toBe(1);
  });
});

describe("promoNotice", () => {
  it("NxM sin completar avisa cuánto llevar", () => {
    expect(promoNotice(withPromo("3x2", "Llevando 3"), 1)).toBe("Promo 3x2: llevando 3 pagás 2");
  });
  it("NxM completado avisa que se agregó gratis", () => {
    expect(promoNotice(withPromo("2x1", "Llevando 2"), 2, 1)).toBe("Promo 2x1: sumamos 1 gratis");
    expect(promoNotice(withPromo("3x2", "Llevando 3"), 3, 1)).toBe("Promo 3x2: sumamos 1 gratis");
  });
  it("otras promos por cantidad avisan el texto de Coto", () => {
    expect(promoNotice(withPromo("70% 2da", "Llevando 2"), 1)).toBe("Promo: 70% 2da llevando 2");
    expect(promoNotice(withPromo("70% 2da", "Llevando 2"), 2)).toBeNull();
  });
  it("sin promo por cantidad no avisa", () => {
    expect(promoNotice(withPromo("30%Dto"), 1)).toBeNull();
  });
});
