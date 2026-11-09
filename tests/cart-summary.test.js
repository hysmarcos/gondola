import { describe, it, expect } from "vitest";
import { analyzeCart } from "../src/cart.js";

const prod = (name, list, discounts = [], extra = {}) => ({
  url: name, sku_display_name: name, product_format: "Litro", product_format_quantity: 1,
  price: [{ store: "200", listPrice: list, formatPrice: list }], discounts, ...extra,
});
const line = (id, name, qty, list, data) => ({ id, name, qty, list, data });
const icbc = (cap) => ({ id: "1", bank: "ICBC", logo: "logo_icbc_1.png", days: [1], percent: 30, cap, capWeekly: true, onlyNoOffer: true });

describe("detalle del carrito", () => {
  const shampoo = line("a", "Shampoo TRESEMME", 1, 11882.99, prod("Shampoo TRESEMME", 11882.99, [{ discountText: "40%Dto", takingText: null, discountPrice: "$7128.61" }]));
  const dove = line("b", "Jabón DOVE", 3, 2738.99, prod("Jabón DOVE", 2738.99, [{ discountText: "3x2", takingText: "Llevando 3", discountPrice: "$1826.08" }]));
  const limpiador = line("c", "Limpiador Heroe", 1, 5750.99, prod("Limpiador Heroe", 5750.99));
  const papas = line("d", "Papas Bem Brasil", 1, 9499, prod("Papas Bem Brasil", 9499));

  it("cada línea dice cuánto le saca Coto y con qué promo", () => {
    const a = analyzeCart([shampoo, dove, limpiador], [], 1, "200");
    const [s, d, l] = a.lines;
    expect(s).toMatchObject({ discount: 4754.38, promoLabel: "40% dto" });
    expect(d).toMatchObject({ discount: 2738.73, promoLabel: "3x2" });
    expect(l).toMatchObject({ discount: 0, promoLabel: null });
    expect(a.discountTotal).toBe(7493.11);
  });

  it("reintegro sin tope: se reparte entre las líneas que aplican", () => {
    const a = analyzeCart([shampoo, limpiador, papas], [icbc(null)], 1, "200");
    expect(a.today).toMatchObject({ refund: 4575, eligible: 15249.99, cap: null, capReached: false, capLeft: null });
    const share = Object.fromEntries(a.lines.map((l) => [l.id, l.bankShare]));
    expect(share).toEqual({ a: 0, c: 1725.3, d: 2849.7 });
  });

  it("reintegro con tope: avisa si se llegó y cuánto falta", () => {
    const lleno = analyzeCart([limpiador, papas], [icbc(2000)], 1, "200").today;
    expect(lleno).toMatchObject({ refund: 2000, capReached: true, capLeft: 0 });
    const falta = analyzeCart([limpiador], [icbc(20000)], 1, "200").today;
    expect(falta).toMatchObject({ refund: 1725.3, capReached: false, capLeft: 18274.7 });
  });
});
