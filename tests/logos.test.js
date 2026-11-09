import { describe, it, expect } from "vitest";
import { readdirSync } from "node:fs";
import { logoUrl, BUNDLED } from "../src/logos.js";
import { unitPrice } from "../src/unit-price.js";

const getURL = (p) => "chrome-extension://abc/" + p;

describe("logos de bancos", () => {
  it("usa el logo empaquetado si lo tenemos", () => {
    expect(logoUrl("logo_icbc_1.png", getURL)).toBe("chrome-extension://abc/assets/banks/logo_icbc_1.png");
  });
  it("si es nuevo, el de Coto", () => {
    expect(logoUrl("logo_nuevo_banco.png", getURL)).toBe("https://static.cotodigital3.com.ar/sitios/cdigi/static/content/images/nuevositio/bancos/logo_nuevo_banco.png");
  });
  it("nombres raros no arman URL", () => {
    expect(logoUrl("../x.png", getURL)).toBeNull();
    expect(logoUrl("javascript:alert(1)", getURL)).toBeNull();
    expect(logoUrl(null, getURL)).toBeNull();
  });
  it("la lista de empaquetados coincide con assets/banks", () => {
    expect([...BUNDLED].sort()).toEqual(readdirSync("assets/banks").sort());
  });
  it("la etiqueta trae el logo del banco que aplica", () => {
    const data = { url: "a", sku_display_name: "Gaseosa 2 L", product_format: "Litro", product_format_quantity: 1, price: [{ store: "200", listPrice: 2000, formatPrice: 1000 }], discounts: [] };
    const icbc = { id: "1", bank: "ICBC", logo: "logo_icbc_1.png", days: [1], percent: 30, cap: null, onlyNoOffer: true };
    expect(unitPrice(data, "200", [icbc], 1)).toMatchObject({ bankName: "ICBC", bankLogo: "logo_icbc_1.png" });
    expect(unitPrice(data, "200", [], 1).bankLogo).toBeNull();
  });
});
