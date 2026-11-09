import { describe, it, expect } from "vitest";
import { auditItems, sizeFromName } from "../src/audit.js";

const d = (name, format, list, formatPrice, extra = {}) => ({
  url: name, sku_display_name: name, product_format: format, product_format_quantity: format ? 1 : 0,
  price: [{ store: "200", listPrice: list, formatPrice }], discounts: [], discounts_payment_methods: [], ...extra,
});
const item = (data, top = "Almacén", cat = "Pastas") => ({ data, top, cat });

describe("sizeFromName", () => {
  it("lee tamaño y packs", () => {
    expect(sizeFromName("Ravioles Ricota 500g")).toMatchObject({ kind: "kg", amounts: [0.5] });
    expect(sizeFromName("Aceite Girasol Botella 1.5 L")).toMatchObject({ kind: "L", amounts: [1.5] });
    expect(sizeFromName("Agua Mineral 6 x 500 ml")).toMatchObject({ kind: "L", amounts: [0.5, 3] });
    expect(sizeFromName("Yerba Mate 1 Kg")).toMatchObject({ kind: "kg", amounts: [1] });
    expect(sizeFromName("Smart Tv 43")).toBeNull();
  });
});

describe("auditItems", () => {
  it("encuentra comida sin unidad, valores raros y tamaños que no cierran", () => {
    const items = [
      item(d("Fideos A 500g", "Kilo", 1000, 2000)),
      item(d("Fideos B 500g", "Kilo", 1100, 2200)),
      item(d("Fideos C 500g", "Kilo", 900, 1800)),
      item(d("Fideos D", "Kilo", 1000, 40000)),
      item(d("Fideos E 500g", "Kilo", 1000, 1000)),
      item(d("Fideos raros", undefined, 1000, undefined)),
      item(d("Smart Tv 43", undefined, 1000, undefined), "Electro", "Tv"),
    ];
    const r = auditItems(items, "200");
    expect(r.noUnit.map((x) => x.name)).toEqual(["Fideos raros"]);
    expect(r.outliers.map((x) => x.name)).toEqual(["Fideos D"]);
    // Fideos E: Coto dice 1 kg pero el nombre 500g; la etiqueta ya usa el nombre.
    expect(r.sizeMismatch).toEqual([]);
    expect(r.counts).toMatchObject({ total: 7, labeled: 5 });
  });
});
