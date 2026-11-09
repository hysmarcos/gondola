import { describe, it, expect } from "vitest";
import { sortByUnitPrice } from "../src/sort.js";
import { row, ACEITE, MIXTA } from "./fixtures/coto.js";

// Producto sintético: precio por unidad = formatPrice (lista 100, sin ofertas).
const item = (url, format, perUnit) => row([url, url, format, format ? 1 : 0, 100, perUnit, null, null, null]);

describe("sortByUnitPrice", () => {
  const input = [
    item("X", null, null),
    item("kg2", "Kilo", 200),
    item("L3", "Litro", 300),
    item("u1", "Unidad", 50),
    item("L1", "Litro", 100),
    item("Y", null, null),
    item("kg1", "Kilo", 150),
    item("L2", "Litro", 200),
  ];

  it("ordena por grupo (el más grande primero) y por valor", () => {
    const { results } = sortByUnitPrice(input, "200");
    expect(results.map((r) => r.data.url)).toEqual(["L1", "L2", "L3", "kg1", "kg2", "u1", "X", "Y"]);
  });

  it("marca el inicio de cada grupo y no etiqueta sin_dato", () => {
    const { labels, marks } = sortByUnitPrice(input, "200");
    expect(marks).toEqual({ L1: "L", kg1: "kg", u1: "unidad" });
    expect(labels.X).toBeUndefined();
    expect(labels.L2).toEqual({ group: "L", value: 200, drained: false, note: null, take: 1, bankValue: null, bankName: null, bankBlocked: null });
  });

  it("ordena por el precio con banco cuando hay promo", () => {
    // A es más barato de lista pero está en oferta; la promo solo vale sin oferta.
    const a = row(["A", "A", "Kilo", 1, 100, 1000, "$95", null, null]);
    const b = item("B", "Kilo", 1010);
    const ciudad = { id: "440", bank: "Ciudad", days: [1], percent: 25, cap: 30000, capWeekly: false, onlyNoOffer: true };
    const { results, labels } = sortByUnitPrice([a, b], "200", [ciudad], 1);
    expect(results.map((r) => r.data.url)).toEqual(["B", "A"]);
    expect(labels.A.bankValue).toBeNull();
    expect(labels.B).toMatchObject({ bankValue: 757.5, bankName: "Ciudad" });
  });

  it("si kg y L empatan, kg va primero", () => {
    const tie = [item("L1", "Litro", 1), item("L2", "Litro", 2), item("k1", "Kilo", 9), item("k2", "Kilo", 8)];
    expect(sortByUnitPrice(tie, "200").results.map((r) => r.data.url)).toEqual(["k2", "k1", "L1", "L2"]);
  });

  it("no modifica la lista original", () => {
    const copy = structuredClone(input);
    sortByUnitPrice(input, "200");
    expect(input).toEqual(copy);
  });

  it("datos reales: aceite arranca por litro y cada grupo va de menor a mayor", () => {
    const { results, labels } = sortByUnitPrice(ACEITE, "200");
    expect(labels[results[0].data.url].group).toBe("L");
    for (const g of ["L", "kg"]) {
      const vals = results.map((r) => labels[r.data.url]).filter((l) => l?.group === g).map((l) => l.value);
      expect(vals).toEqual([...vals].sort((a, b) => a - b));
    }
  });

  it("datos reales: búsqueda mixta deja los sin dato al final en su orden", () => {
    const { results } = sortByUnitPrice(MIXTA, "200");
    const tail = results.slice(-4).map((r) => r.data.sku_display_name.split(" ")[0]);
    expect(tail).toEqual(["Playmobil", "Panquequera", "Set", "Anchoita"]);
  });
});
