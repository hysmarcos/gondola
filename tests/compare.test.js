import { describe, it, expect } from "vitest";
import { validEan, compareFields, classify } from "../src/compare.js";
import { labelsFor } from "../src/sort.js";

const base = (extra = {}) => ({
  product_main_ean: "7790742348302",
  price: [{ store: "200", listPrice: 2225 }],
  discounts: [],
  discounts_payment_methods: [],
  ...extra,
});

describe("validEan", () => {
  it("acepta 8 a 14 dígitos", () => {
    expect(validEan("7790742348302")).toBe("7790742348302");
    expect(validEan(7790742348302)).toBe("7790742348302");
    expect(validEan(" 7790742348302 ")).toBe("7790742348302");
  });
  it("rechaza lo demás", () => {
    for (const v of ["", "0", "00000000", "77ABC", undefined, null, "1234567", "123456789012345"]) {
      expect(validEan(v)).toBeNull();
    }
  });
});

describe("compareFields", () => {
  it("usa el precio final y la cantidad a llevar", () => {
    const data = base({ discounts: [{ discountText: "", takingText: "Llevando 2", discountPrice: "$1899" }] });
    expect(compareFields(data, "200")).toEqual({ ean: "7790742348302", cmp: { unit: 1899, qty: 2 } });
  });
  it("sin oferta: precio de lista, qty 1", () => {
    expect(compareFields(base(), "200").cmp).toEqual({ unit: 2225, qty: 1 });
  });
  it("pesable: sin cmp", () => {
    expect(compareFields(base({ product_weighable: 1 }), "200")).toEqual({ ean: "7790742348302", cmp: null });
    expect(compareFields(base({ product_unit_of_measure: "KGS" }), "200").cmp).toBeNull();
  });
  it("sin EAN o sin precio: sin cmp", () => {
    expect(compareFields(base({ product_main_ean: "" }), "200")).toEqual({ ean: null, cmp: null });
    expect(compareFields(base({ price: [] }), "200").cmp).toBeNull();
    expect(compareFields(null, "200")).toEqual({ ean: null, cmp: null });
  });
  it("Comunidad: usa el mismo precio que la tarjeta, con o sin el ajuste", () => {
    const data = base({
      sku_display_name: "Gaseosa X 2 L", product_format: "Litro", product_format_quantity: 1,
      price: [{ store: "200", listPrice: 2225, formatPrice: 1112.5 }],
      discounts: [{ discountText: "15%Dto", takingText: null, discountPrice: "$1891" }, { discountText: "+5%", takingText: null, discountPrice: "$1780" }],
    });
    expect(compareFields(data, "200").cmp).toEqual({ unit: 1780, qty: 1 });
    expect(compareFields(data, "200", { comunidad: false }).cmp).toEqual({ unit: 1891, qty: 1 });
    for (const opts of [{}, { comunidad: false }]) {
      const label = labelsFor([{ data: { ...data, url: "_/R-1" } }], "200", [], 0, opts)["_/R-1"];
      expect(label.cmp.unit).toBe(label.price);
    }
  });
});

describe("classify", () => {
  it("tolerancia de 1%", () => {
    expect(classify(1000, 989)).toBe("lower");
    expect(classify(1000, 990)).toBe("equal");
    expect(classify(1000, 1010)).toBe("equal");
    expect(classify(1000, 1011)).toBe("higher");
  });
});
