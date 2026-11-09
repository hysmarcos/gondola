import { describe, it, expect } from "vitest";
import { exclusionReason } from "../src/exclusions.js";
import { unitPrice } from "../src/unit-price.js";

const p = (name, extra = {}) => ({
  sku_display_name: name, product_format: "Kilo", product_format_quantity: 1,
  price: [{ store: "200", listPrice: 1000, formatPrice: 2000 }], discounts: [], discounts_payment_methods: [], ...extra,
});
const inGroup = (id) => ({ groups: [{ group_id: id, display_name: "x" }] });

describe("exclusionReason", () => {
  it("excluye por categoría de Coto", () => {
    expect(exclusionReason(p("Azúcar La Campechana 1kg", inGroup("catv00002784")))).toBe("excluido");
    expect(exclusionReason(p("Bife de chorizo", inGroup("catv00001292")))).toBe("excluido");
    expect(exclusionReason(p("Smart Tv 43", inGroup("catv00001990")))).toBe("excluido");
  });

  it("excluye por nombre", () => {
    expect(exclusionReason(p("Aceite De Girasol Natura 1.5 L"))).toBe("excluido");
    expect(exclusionReason(p("Aceite Mezcla Cocinero Pet 900 Ml"))).toBe("excluido");
    expect(exclusionReason(p("Salame Milan Paladini 200g"))).toBe("excluido");
    expect(exclusionReason(p("Pechuga De Pollo Congelada X Kg"))).toBe("excluido");
    expect(exclusionReason(p("Leche Infantil Nutrilon Etapa 1 800g"))).toBe("excluido");
    expect(exclusionReason(p("Neumático Pirelli 175/65"))).toBe("excluido");
  });

  it("excluye por marca", () => {
    expect(exclusionReason(p("Gaseosa Coca-Cola Sabor Original 2,25 L"))).toBe("excluido");
    expect(exclusionReason(p("Agua Saborizada", { product_brand: "AQUARIUS" }))).toBe("excluido");
    expect(exclusionReason(p("Espumante Chandon Extra Brut 750ml"))).toBe("excluido");
    expect(exclusionReason(p("Vino Alma Negra Malbec 750ml"))).toBe("excluido");
  });

  it("no excluye lo que no corresponde", () => {
    expect(exclusionReason(p("Aceite De Oliva Extra Virgen Natura 500ml"))).toBeNull();
    expect(exclusionReason(p("Leche Entera La Serenisima 1l"))).toBeNull();
    expect(exclusionReason(p("Ravioles Jamón y queso 500g", inGroup("catv00001869")))).toBeNull();
    expect(exclusionReason(p("Pollo al curry congelado listo"))).toBeNull();
  });
});

describe("banco en la etiqueta", () => {
  const icbc = { id: "457", bank: "ICBC", days: [1], percent: 30, cap: 20000, capWeekly: false, onlyNoOffer: false };

  it("en oferta: el banco no suma", () => {
    const o = p("Ravioles", { discounts: [{ discountText: "25%Dto", takingText: null, discountPrice: "$750" }] });
    expect(unitPrice(o, "200", [icbc], 1)).toMatchObject({ bankValue: null, bankBlocked: "oferta" });
    const both = { ...o, ...inGroup("catv00002784") };
    expect(unitPrice(both, "200", [icbc], 1).bankBlocked).toBe("oferta");
  });

  it("excluido sin oferta", () => {
    expect(unitPrice(p("Azúcar", inGroup("catv00002784")), "200", [icbc], 1)).toMatchObject({ bankValue: null, bankBlocked: "excluido" });
  });

  it("sin promo ese día: nada", () => {
    expect(unitPrice(p("Ravioles"), "200", [icbc], 2)).toMatchObject({ bankValue: null, bankBlocked: null });
    expect(unitPrice(p("Ravioles"), "200", [icbc], 1)).toMatchObject({ bankValue: 1400, bankName: "ICBC", bankBlocked: null });
  });
});
