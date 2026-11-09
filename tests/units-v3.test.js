import { describe, it, expect } from "vitest";
import { normalizeUnit, unitPrice } from "../src/unit-price.js";
import { paperMetric } from "../src/paper.js";

const data = (name, format, qty, list, formatPrice, extra = {}) => ({
  sku_display_name: name, product_format: format, product_format_quantity: qty,
  price: [{ store: "200", listPrice: list, formatPrice }], discounts: [], discounts_payment_methods: [], ...extra,
});

describe("unidades nuevas", () => {
  it("normaliza los formatos raros de Coto", () => {
    expect(normalizeUnit("Gramos escurridos", 100)).toEqual({ group: "kg", factor: 10, drained: true });
    expect(normalizeUnit("Kilogramo escurrido", 1)).toEqual({ group: "kg", factor: 1, drained: true });
    expect(normalizeUnit("Cuadrado", 1)).toEqual({ group: "m2", factor: 1, drained: false });
    expect(normalizeUnit("Metro", 1)).toEqual({ group: "m", factor: 1, drained: false });
    expect(normalizeUnit("Cúbicos", 100)).toEqual({ group: "L", factor: 10, drained: false });
    expect(normalizeUnit("Medida", 1).group).toBe("sin_dato");
  });

  it("pesables sin formato: el precio ya es por kilo", () => {
    const jamon = data("Jamón Cocido Feteado PRIMERA MARCA X Kg", undefined, 0, 15175, undefined, { product_weighable: 1, product_unit_of_measure: "KGS" });
    expect(unitPrice(jamon, "200")).toMatchObject({ group: "kg", value: 15175 });
    const conOferta = { ...jamon, discounts: [{ discountText: "20%Dto", takingText: null, discountPrice: "$12140" }] };
    expect(unitPrice(conOferta, "200").value).toBe(12140);
  });

  it("pomada en cm³ va a litros", () => {
    const p = data("Pomada Marron Wassington Lat 37 Cmq", "Cúbicos", 100, 4657.99, 12589.17);
    expect(unitPrice(p, "200")).toMatchObject({ group: "L", value: 125891.7 });
  });
});

describe("papel", () => {
  it("lee metros y rollos del papel higiénico", () => {
    expect(paperMetric("Papel Higiénico HIGIENOL Max Hoja Simple 100 M 4 Un")).toMatchObject({ group: "rollo10m", divisor: 40, note: null });
    expect(paperMetric("P.Higienico 80 Mts Campanita X 4 32 M2")).toMatchObject({ group: "rollo10m", divisor: 32 });
    expect(paperMetric("Papel Higiénico Felpita Superpack Blanco 24 rollos x 30m")).toMatchObject({ group: "rollo10m", divisor: 72 });
    expect(paperMetric("Papel Higiénico HIGIENOL Plus Fusión Doble Hoja 30 M 4 Un")).toMatchObject({ group: "rollo10m", divisor: 12, note: "doble hoja" });
    expect(paperMetric("P.Higienico S/H X 30 Mtr Cristal Del Paq 12 M2")).toMatchObject({ group: null, divisor: null, note: null });
  });

  it("lee paños y rollos de cocina", () => {
    expect(paperMetric("Rollos De Cocina 180 Paños X3 Felpita 7.59m2")).toMatchObject({ group: "panos100", divisor: 5.4 });
    expect(paperMetric("Rollo Cocina SUSSEX Clásico 50 Paños 3 Un")).toMatchObject({ group: "panos100", divisor: 1.5 });
    expect(paperMetric("Rollos De Cocina Maxirollo 200 Paños FELPITA 2.8m")).toMatchObject({ group: "panos100", divisor: 2 });
  });

  it("sin metros: m² con nota de doble hoja", () => {
    expect(paperMetric("Papel Higiénico FELPITA Doble Hoja Paquete 4 Unidades")).toMatchObject({ group: null, divisor: null, note: "doble hoja" });
    expect(paperMetric("Shampoo Dove 400 ml")).toBeNull();
  });

  it("unitPrice usa la medida del papel", () => {
    const p = data("Papel Higiénico HIGIENOL Max Hoja Simple 100 M 4 Un", "Cuadrado", 1, 8253.99, 206.35);
    expect(unitPrice(p, "200")).toMatchObject({ group: "rollo10m", value: 206.35, note: null });
    const k = data("Rollos De Cocina 180 Paños X3 Felpita 7.59m2", "Cuadrado", 1, 2999.99, 395.26);
    expect(unitPrice(k, "200")).toMatchObject({ group: "panos100", value: 555.55 });
    const dh = data("Papel Higiénico FELPITA Doble Hoja Paquete 4 Unidades", "Cuadrado", 1, 4753.99, 396.17);
    expect(unitPrice(dh, "200")).toMatchObject({ group: "rollo10m", value: 396.17, note: "doble hoja · ≈ ancho 10 cm" });
    const film = data("Rollo Film Adherente SEPARATA 30 Metros Paquete 1 Unidad", "Metro", 1, 3000, 100);
    expect(unitPrice(film, "200")).toMatchObject({ group: "m", value: 100 });
  });
});

describe("v4: papel higiénico sin metros en el nombre", () => {
  it("lee \"4x30m\" como 4 rollos de 30 m", () => {
    expect(paperMetric("Papel higiénico Soft & Strong ELITE 4x30m")).toMatchObject({ group: "rollo10m", divisor: 12 });
  });
  it("saca los metros del m² de Coto (rollo de 10 cm)", () => {
    const cristal = data("Papel Higiénico Cristal del Lago Hoja Simple Súper Suave 4 rollos", "Cuadrado", 1, 5099.99, 159.38,
      { discounts: [{ discountText: "30%Dto", takingText: null, discountPrice: "$3498.59" }] });
    expect(unitPrice(cristal, "200")).toMatchObject({ group: "rollo10m", value: 109.33, note: "≈ ancho 10 cm" });
  });
  it("doble hoja suma su nota", () => {
    const felpita = data("P.Higienico D/H X 4 Rollos Felpita Paq 8 M2", "Cuadrado", 1, 3142.99, 392.88);
    expect(unitPrice(felpita, "200")).toMatchObject({ group: "rollo10m", note: "doble hoja · ≈ ancho 10 cm" });
  });
  it("rollo de cocina sin paños sigue en m²", () => {
    const cocina = data("Rollo de Cocina Sussex 3 un", "Cuadrado", 1, 3000, 300);
    expect(unitPrice(cocina, "200").group).toBe("m2");
  });
});

describe("revisión v4: tope de m² en papel", () => {
  it("un m² absurdo de Coto no da etiqueta por 10 m", () => {
    const raro = data("Papel Higiénico Raro Paquete 4 Unidades", "Cuadrado", 1, 5000, 1);
    expect(unitPrice(raro, "200").group).not.toBe("rollo10m");
  });
});
