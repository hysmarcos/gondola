import { describe, it, expect } from "vitest";
import { sortByUnitPrice, labelsFor } from "../src/sort.js";
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
    expect(labels.L2).toMatchObject({ group: "L", value: 200, drained: false, note: null, take: 1, bankValue: null, bankName: null, bankBlocked: null, ean: null, cmp: null });
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
    const tail = results.slice(-3).map((r) => r.data.sku_display_name.split(" ")[0]);
    expect(tail).toEqual(["Playmobil", "Panquequera", "Set"]);
  });
});

describe("v3: grupos nuevos", () => {
  it("ordena grupos por tamaño con el orden de desempate del spec", () => {
    const paper = (url, meters, price) => row([url, `Papel Higiénico X ${meters} M 4 Un`, "Cuadrado", 1, price, 1, null, null, null]);
    const m2 = (url, price) => row([url, `Rollo De Cocina Y Paquete 4 Unidades`, "Cuadrado", 1, 100, price, null, null, null]);
    const input = [m2("A", 300), paper("P1", 30, 1200), m2("B", 200), paper("P2", 50, 1000), item("k1", "Kilo", 10)];
    const { results, marks } = sortByUnitPrice(input, "200");
    expect(results.map((r) => r.data.url)).toEqual(["P2", "P1", "B", "A", "k1"]);
    expect(marks).toEqual({ P2: "rollo10m", B: "m2", k1: "kg" });
  });
});

describe("labelsFor con EAN", () => {
  it("suma ean y cmp a la etiqueta", () => {
    const r = item("E1", "Kilo", 150);
    r.data.product_main_ean = "7790742348302";
    const labels = labelsFor([r, item("E2", "Kilo", 150)], "200");
    expect(labels.E1.ean).toBe("7790742348302");
    expect(labels.E1.cmp).toEqual({ unit: 100, qty: 1 });
    expect(labels.E2).toMatchObject({ ean: null, cmp: null });
  });
});

describe("sortByUnitPrice con EAN", () => {
  it("las etiquetas del orden por kg/L llevan ean y cmp como labelsFor", () => {
    const r = item("E1", "Kilo", 150);
    r.data.product_main_ean = "7790742348302";
    r.data.id = "00012345";
    const { labels } = sortByUnitPrice([r, item("E2", "Kilo", 200)], "200");
    expect(labels.E1.ean).toBe("7790742348302");
    expect(labels.E1.cmp).toEqual({ unit: 100, qty: 1 });
    expect(labels["00012345"]).toBe(labels.E1);
    expect(labels.E2).toMatchObject({ ean: null, cmp: null });
    expect(labels).toEqual(labelsFor([r, item("E2", "Kilo", 200)], "200"));
  });
});

describe("etiquetas con nutri", () => {
  const food = (url, groupId, extra = {}) => {
    const r = item(url, "Kilo", 150);
    Object.assign(r.data, { product_main_ean: "7790742348302", groups: [{ group_id: groupId }], ...extra });
    return r;
  };

  it("comida sí; limpieza y pesables no (labelsFor)", () => {
    const labels = labelsFor([food("A", "catv00001254"), food("B", "catv00001258"), food("C", "catv00001255", { product_weighable: 1 })], "200");
    expect(labels.A.nutri).toBe(true);
    expect(labels.B.nutri).toBe(false);
    expect(labels.C.nutri).toBe(false);
  });

  it("sortByUnitPrice también marca nutri", () => {
    const { labels } = sortByUnitPrice([food("A", "catv00001254"), food("B", "catv00001258")], "200");
    expect(labels.A.nutri).toBe(true);
    expect(labels.B.nutri).toBe(false);
  });
});
