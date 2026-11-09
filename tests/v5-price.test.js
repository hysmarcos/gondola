import { describe, it, expect } from "vitest";
import { finalPrice, unitPrice } from "../src/unit-price.js";
import { sortByUnitPrice } from "../src/sort.js";
import { analyzeCart } from "../src/cart.js";

const cola = {
  url: "_/R-1", sku_display_name: "Gaseosa Cola Original Coto 2250cc", product_format: "Litro", product_format_quantity: 1,
  price: [{ store: "200", listPrice: 1999.99, formatPrice: 888.88 }],
  discounts: [{ discountText: "15%Dto", takingText: null, discountPrice: "$1699.99" }, { discountText: "+5%", takingText: null, discountPrice: "$1599.99" }],
  discounts_payment_methods: [{ precioCuota: "$1699.99", cantidadCuotas: "1" }],
};
const plain = (url, list, extra = {}) => ({ url, sku_display_name: "Gaseosa X 2 L", product_format: "Litro", product_format_quantity: 1, price: [{ store: "200", listPrice: list, formatPrice: list / 2 }], discounts: [], ...extra });

describe("v5: Comunidad", () => {
  it("el precio Comunidad (+N%) se usa salvo que se apague", () => {
    expect(finalPrice(cola, "200")).toBe(1599.99);
    expect(finalPrice(cola, "200", { comunidad: false })).toBe(1699.99);
  });

  it("la etiqueta trae precio, regular, de dónde sale y la oferta unificada", () => {
    expect(unitPrice(cola, "200")).toMatchObject({ value: 711.1, price: 1599.99, list: 1999.99, via: "comunidad", offerText: "15% dto + 5% Comunidad" });
    expect(unitPrice(cola, "200", [], 0, { comunidad: false })).toMatchObject({ price: 1699.99, via: "oferta", offerText: "15% dto" });
  });

  it("otros orígenes del precio", () => {
    expect(unitPrice(plain("a", 2000), "200")).toMatchObject({ via: "lista", offerText: null, price: 2000 });
    const dosPorUno = plain("b", 2000, { discounts: [{ discountText: "2x1", takingText: "Llevando 2", discountPrice: "$1000" }] });
    expect(unitPrice(dosPorUno, "200")).toMatchObject({ via: "oferta", offerText: "2x1", take: 2 });
    const unPago = plain("c", 2000, { discounts: [{ discountText: "1 Pago 15%", takingText: null, discountPrice: "$1700" }] });
    expect(unitPrice(unPago, "200")).toMatchObject({ via: "1pago", offerText: "15% en 1 pago" });
    const segunda = plain("d", 2000, { discounts: [{ discountText: "70% 2da", takingText: "Llevando 2", discountPrice: "$1300" }] });
    expect(unitPrice(segunda, "200").offerText).toBe("70% la 2da");
  });

  it("el carrito respeta el ajuste", () => {
    const lines = [{ id: "p", name: "Cola", qty: 1, list: 1999.99, data: cola }];
    expect(analyzeCart(lines, [], 0, "200").total).toBe(1599.99);
    expect(analyzeCart(lines, [], 0, "200", { comunidad: false }).total).toBe(1699.99);
  });
});

describe("v5: más barato de la categoría", () => {
  it("el primero de cada grupo con 3 o más productos", () => {
    const rows = [plain("a", 3000), plain("b", 2000), plain("c", 4000)].map((data) => ({ data }));
    const kilo = (url, list) => ({ data: { url, sku_display_name: "Queso", product_format: "Kilo", product_format_quantity: 1, price: [{ store: "200", listPrice: list, formatPrice: list }], discounts: [] } });
    const { best } = sortByUnitPrice([...rows, kilo("k1", 100), kilo("k2", 50)], "200");
    expect(best).toEqual({ b: "L" });
  });

  it("con banco, gana el más barato con banco", () => {
    const icbc = { id: "1", bank: "ICBC", days: [1], percent: 50, cap: null, onlyNoOffer: true };
    const oferta = plain("o", 1500, { discounts: [{ discountText: "10%Dto", takingText: null, discountPrice: "$1400" }] });
    const rows = [plain("a", 2000), oferta, plain("c", 4000)].map((data) => ({ data }));
    expect(sortByUnitPrice(rows, "200", [icbc], 1).best).toEqual({ a: "L" });
  });
});
