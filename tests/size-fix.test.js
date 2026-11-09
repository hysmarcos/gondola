import { describe, it, expect } from "vitest";
import { unitPrice } from "../src/unit-price.js";
import { sizeFromName } from "../src/size.js";

const d = (name, format, qty, list, formatPrice) => ({
  sku_display_name: name, product_format: format, product_format_quantity: qty,
  price: [{ store: "200", listPrice: list, formatPrice }], discounts: [], discounts_payment_methods: [],
});

describe("sizeFromName (casos reales de Coto)", () => {
  it("entiende kgm, grm, decimales con punto adelante y packs", () => {
    expect(sizeFromName("Yerba Mate Despalada Rosamonte Paq 1 Kgm")).toMatchObject({ kind: "kg", amounts: [1] });
    expect(sizeFromName("J.Crudo Pata Serrano R Artysan Bsa 7.5 Kgm")).toMatchObject({ kind: "kg", amounts: [7.5] });
    expect(sizeFromName("Alim. Gatos Purina One Bsa .5 Grm")).toMatchObject({ kind: "kg", amounts: [0.5] });
    expect(sizeFromName("Gaseosa Coca-Cola Combo Dúo Original y Zero 2x1.75L")).toMatchObject({ kind: "L", amounts: [1.75, 3.5] });
    expect(sizeFromName("SPRAY TEXTIL ROSA BULGARA 250ML TAO")).toMatchObject({ kind: "L", amounts: [0.25] });
  });
});

describe("corrección con el tamaño del nombre", () => {
  it("si formatPrice no cierra con el nombre, usa el nombre", () => {
    expect(unitPrice(d("Vodka Raspberri Absolut Bot 700 Ml", "Litro", 1, 24263.4, 34662000), "200")).toMatchObject({ group: "L", value: 34662 });
    expect(unitPrice(d("Yerba Mate Despalada Rosamonte Paq 1 Kgm", "Kilo", 1, 5000, 5), "200")).toMatchObject({ group: "kg", value: 5000 });
    expect(unitPrice(d("Gaseosa Coca-Cola Combo Dúo Original y Zero 2x1.75L", "Litro", 1, 7000, 2), "200")).toMatchObject({ group: "L", value: 2000 });
  });

  it("si coincide (pack o unidad), deja el de Coto", () => {
    expect(unitPrice(d("Agua Mineral 6 x 500 ml", "Litro", 1, 3000, 1000), "200").value).toBe(1000);
    expect(unitPrice(d("Ravioles 500g", "Kilo", 1, 3459, 6918), "200").value).toBe(6918);
  });

  it("'.5 Grm' es medio kilo", () => {
    expect(unitPrice(d("Alim. Gatos Sabor Pollo Y Purina One Bsa .5 Grm", "Kilo", 1, 6344, 12688000), "200")).toMatchObject({ group: "kg", value: 12688 });
    expect(unitPrice(d("Queso Azul Grandblu Bavaria Fwp .125 Grm", "Gramos", 100, 6239, 4991200), "200")).toMatchObject({ value: 49912 });
  });

  it("si ninguno es creíble, no muestra nada", () => {
    expect(unitPrice(d("Mate Cocido PLAYADITO Caja 25 Saquitos", "Gramos escurridos", 100, 1399, 186533.34), "200").group).toBe("sin_dato");
  });

  it("sin formato: usa el tamaño del nombre o 'X Kg'", () => {
    expect(unitPrice(d("SPRAY TEXTIL ROSA BULGARA 250ML TAO", undefined, 0, 5000, undefined), "200")).toMatchObject({ group: "L", value: 20000 });
    expect(unitPrice(d("Filete De Merluza Despinado Congelado X Kg", "Medida", 1, 11990, 11990), "200")).toMatchObject({ group: "kg", value: 11990 });
    expect(unitPrice(d("Smart Tv 43", undefined, 0, 500000, undefined), "200").group).toBe("sin_dato");
  });
});

describe("vuelta 2 del loop", () => {
  it("ml o cc con decimales son litros", () => {
    expect(sizeFromName("FANTA Zero Naranja 1,75 Ml")).toMatchObject({ kind: "L", amounts: [1.75] });
    expect(unitPrice(d("FANTA Zero Naranja 1,75 Ml", "Litro", 1, 5400, 3085.71), "200").value).toBe(3085.71);
    expect(unitPrice(d("Gaseosa Sabor Cola CUNNINGTON Suave 2.25cc", "Litro", 1, 2750, 1222.22), "200").value).toBe(1222.22);
  });

  it("'1 Grm' no es creíble: queda el dato de Coto", () => {
    expect(unitPrice(d("Dulce De Batata Light Emeth Bja 1 Grm", "Kilo escurrido", 1, 3299, 6872.91), "200")).toMatchObject({ group: "kg", value: 6872.91 });
  });

  it("carne 'X KG' con peso aproximado: el precio ya es por kilo", () => {
    expect(unitPrice(d("Asado (peso Aproximado De La Unidad 2.170 Kg) X KG", "Kilo", 1, 16999, 16999), "200").value).toBe(16999);
  });

  it("productos chicos de verdad tienen etiqueta", () => {
    expect(unitPrice(d("Azafran Machacado Indo 4g", "Gramos", 100, 8650, 216250), "200")).toMatchObject({ group: "kg", value: 2162500 });
    expect(unitPrice(d("Nuez Moscada Grano La Parmesan Bli 2 Grm", "Gramos", 100, 2428, 121400), "200").group).toBe("kg");
  });

  it("nombre con dos tamaños distintos: queda el dato de Coto", () => {
    expect(unitPrice(d("Antihumedad Mini Pino 75 Grm C/ Aire Pur Est 3 Grm", "Kilo", 1, 21061.99, 140413.26), "200").value).toBe(140413.26);
  });
});

describe("vuelta 4 del loop", () => {
  const nonFood = (name, top) => ({ ...d(name, undefined, 0, 100000, undefined), groups: [{ group_id: top }] });

  it("no inventa $/L ni $/kg en productos que no son de consumo", () => {
    expect(unitPrice(nonFood("Motosierra 25.4 Cc Daewoo Dcs2512 12\"", "catv00001260"), "200").group).toBe("sin_dato");
    expect(unitPrice(nonFood("Pileta Estructural MOR 1500 L", "catv00001261"), "200").group).toBe("sin_dato");
    expect(unitPrice(nonFood("Secador De Cabello PHILIPS CC 2", "catv00001990"), "200").group).toBe("sin_dato");
    expect(unitPrice(nonFood("Spray Textil 250ML TAO", "catv00001258"), "200").group).toBe("L");
  });

  it("un tamaño pegado a letras no es tamaño", () => {
    expect(sizeFromName("Mouse PHILIPS INALÁMBRICO Spk7378g/55 Usb-a Gris")).toBeNull();
  });

  it("'1250 Kgm' son gramos", () => {
    expect(sizeFromName("Yog.Beb. Ent. Fort. Fru Milkaut Sch 1250 Kgm")).toMatchObject({ kind: "kg", amounts: [1.25] });
    expect(unitPrice(d("Yog.Beb. Ent. Fort. Fru Milkaut Sch 1250 Kgm", "Kilogramo", 1, 5965, 4970.84), "200").value).toBe(4970.84);
  });

  it("'500X350 Ml' es ambiguo: queda el dato de Coto", () => {
    expect(sizeFromName("Enjuague Bucal Colgate Plax Fresh Mint 500X350 Ml")).toMatchObject({ multi: true });
    expect(unitPrice(d("Enjuague Bucal Colgate Plax Fresh Mint 500X350 Ml", "Litro", 1, 7840.99, 15681.98), "200").value).toBe(15681.98);
  });
});
