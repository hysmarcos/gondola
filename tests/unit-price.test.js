import { describe, it, expect } from "vitest";
import { parseMoney } from "../src/money.js";
import { normalizeUnit, pickStorePrice, finalPrice, unitPrice, takeQty, isOnSale } from "../src/unit-price.js";
import { PASTAS, MIXTA } from "./fixtures/coto.js";

describe("parseMoney", () => {
  it("lee los formatos de Coto", () => {
    expect(parseMoney("$2588.72")).toBe(2588.72);
    expect(parseMoney("$2.588,72")).toBe(2588.72);
    expect(parseMoney("$12.099")).toBe(12099);
    expect(parseMoney("$1163.5")).toBe(1163.5);
    expect(parseMoney("abc")).toBeNull();
    expect(parseMoney(null)).toBeNull();
    expect(parseMoney(3459)).toBe(3459);
  });
});

describe("normalizeUnit", () => {
  it("agrupa los nombres de Coto", () => {
    expect(normalizeUnit("Kilo", 1)).toEqual({ group: "kg", factor: 1, drained: false });
    expect(normalizeUnit("Kilogramo", 1).group).toBe("kg");
    expect(normalizeUnit("Kilo escurrido", 1)).toEqual({ group: "kg", factor: 1, drained: true });
    expect(normalizeUnit("Gramos", 100)).toEqual({ group: "kg", factor: 10, drained: false });
    expect(normalizeUnit("Litro escurrido", 1)).toEqual({ group: "L", factor: 1, drained: true });
    expect(normalizeUnit("Mililitros", 100)).toEqual({ group: "L", factor: 10, drained: false });
    expect(normalizeUnit("  UNIDAD ", 1).group).toBe("unidad");
    expect(normalizeUnit("", 0).group).toBe("sin_dato");
    expect(normalizeUnit(undefined, 0).group).toBe("sin_dato");
    expect(normalizeUnit("Kilo", 0).group).toBe("sin_dato");
    expect(normalizeUnit("Metro", 1).group).toBe("sin_dato");
  });
});

const p = {
  product_format: "Kilo",
  product_format_quantity: 1,
  price: [
    { store: "200", listPrice: 3459, formatPrice: 6918 },
    { store: "061", listPrice: 2995, formatPrice: 5990 },
  ],
  discounts: [{ discountPrice: "$2594.25" }],
  discounts_payment_methods: [
    { precioCuota: "$2500", cantidadCuotas: "1" },
    { precioCuota: "$500", cantidadCuotas: "6" },
  ],
};

describe("precios", () => {
  it("elige la sucursal", () => {
    expect(pickStorePrice(p, "061")).toEqual({ listPrice: 2995, formatPrice: 5990 });
    expect(pickStorePrice(p, "999").listPrice).toBe(3459);
    expect(pickStorePrice({ price: [] }, "200")).toBeNull();
  });

  it("usa el precio más bajo e ignora cuotas > 1", () => {
    expect(finalPrice(p, "200")).toBe(2500);
  });

  it("calcula el precio por unidad", () => {
    expect(unitPrice(p, "200")).toEqual({ group: "kg", value: 5000, drained: false, take: 1, bankValue: null, bankName: null });
    const zero = { ...p, price: [{ store: "200", listPrice: 0, formatPrice: 0 }] };
    expect(unitPrice(zero, "200").group).toBe("sin_dato");
  });

  it("datos reales: pastas son kg y el 25% off baja el $/kg", () => {
    for (const r of PASTAS) expect(unitPrice(r.data, "200").group).toBe("kg");
    const rav = PASTAS.find((r) => r.data.sku_display_name.startsWith("Ravioles Jamón y queso")).data;
    expect(unitPrice(rav, "200").value).toBeCloseTo(2 * finalPrice(rav, "200"), 2);
  });

  it("promos por cantidad y banco", () => {
    const leche = {
      product_format: "Litro", product_format_quantity: 1,
      price: [{ store: "200", listPrice: 2499, formatPrice: 2499 }],
      discounts: [{ discountText: "3x2", takingText: "Llevando 3", discountPrice: "$1666.08" }],
      discounts_payment_methods: [{ precioCuota: "$1666.08", cantidadCuotas: "1" }],
    };
    expect(takeQty(leche, "200")).toBe(3);
    expect(isOnSale(leche)).toBe(true);
    const listerine = { ...leche, discounts: [{ discountText: "35%Dto", takingText: null, discountPrice: "$6330.99" }] };
    expect(takeQty(listerine, "200")).toBe(1);
    // Si la oferta "llevando N" no es la más barata, no se exige llevar N.
    const pago = { ...leche, discounts_payment_methods: [{ precioCuota: "$1500", cantidadCuotas: "1" }] };
    expect(takeQty(pago, "200")).toBe(1);

    const icbc = { id: "457", bank: "ICBC", days: [1], percent: 30, cap: 20000, capWeekly: false, onlyNoOffer: false };
    const sinOferta = { ...leche, discounts: [], discounts_payment_methods: [] };
    expect(unitPrice(sinOferta, "200", [icbc], 1)).toMatchObject({ value: 2499, bankValue: 1749.3, bankName: "ICBC" });
    expect(unitPrice(sinOferta, "200", [icbc], 2).bankValue).toBeNull();
    expect(unitPrice(leche, "200", [icbc], 1)).toMatchObject({ take: 3, bankValue: 1166.26 });
  });

  it("datos reales: 12 cuotas no cuentan como precio final", () => {
    const panq = MIXTA.find((r) => r.data.sku_display_name.startsWith("Panquequera ATMA")).data;
    expect(finalPrice(panq, "200")).toBe(29999.25);
    expect(unitPrice(panq, "200").group).toBe("sin_dato");
    const bisc = MIXTA.find((r) => r.data.product_format === "Gramos").data;
    expect(unitPrice(bisc, "200").value).toBeCloseTo(56149.5, 1);
  });
});
