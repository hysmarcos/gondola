import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { exclusionText, hashOf } from "../src/bank-rules/hash.js";
import { RULES, statusOf, excluded, promoEntries } from "../src/bank-rules/index.js";
import { parseMas } from "../src/bank-promos/mas.js";
import { parseDia } from "../src/bank-promos/dia.js";
import { CARDS } from "../src/cards.js";

const A = "VÁLIDO TODOS LOS JUEVES DE NOVIEMBRE 2026. NO INCLUYE CARNICERÍA, FRUTAS NI VERDURAS. TOPE $10.000.";
const B = "VÁLIDO TODOS LOS JUEVES DE DICIEMBRE 2026. NO INCLUYE CARNICERÍA, FRUTAS NI VERDURAS. TOPE $12.000.";
const C = "VÁLIDO TODOS LOS JUEVES DE NOVIEMBRE 2026. NO INCLUYE CARNICERÍA, FRUTAS, VERDURAS NI LÁCTEOS. TOPE $10.000.";
const rules = { cardOf: (p) => (p.bankLabel === "X" ? { cardId: "modo", plan: null } : null), exclusions: [{ hash: hashOf(exclusionText(A)), test: (pr) => /carne/.test(pr.name) }] };
const product = (name, o = {}) => ({ name, brand: "", groups: [], onSale: false, ...o });

describe("exclusionText y hashOf", () => {
  it("se queda con las oraciones de exclusiones, sin números ni acentos", () => {
    expect(exclusionText(A)).toBe("NO INCLUYE CARNICERIA FRUTAS NI VERDURAS");
    expect(exclusionText("")).toBe("");
    expect(exclusionText(undefined)).toBe("");
  });

  it("un cambio de fecha o de tope no cambia la huella; un rubro nuevo sí", () => {
    expect(hashOf(exclusionText(A))).toBe(hashOf(exclusionText(B)));
    expect(hashOf(exclusionText(A))).not.toBe(hashOf(exclusionText(C)));
  });

  it("parte por saltos de línea y une con |", () => {
    expect(exclusionText("Excluye vinos\nPromo no acumulable con otras")).toBe("EXCLUYE VINOS|PROMO NO ACUMULABLE CON OTRAS");
  });

  it("después de un título 'EXCLUIDOS:' entra la lista que sigue", () => {
    const base = "Válido el martes.\r\n\r\nEXCLUIDOS - NO INCLUYE:\r\n\r\nQuesos, Huevos.\r\n\r\nVinos";
    expect(exclusionText(base)).toBe("EXCLUIDOS NO INCLUYE|QUESOS HUEVOS|VINOS");
    expect(hashOf(exclusionText(base))).not.toBe(hashOf(exclusionText(base.replace("Vinos", "Vinos, Fernet"))));
  });

  it("toma otras formas de restringir productos, no las de vigencia", () => {
    expect(exclusionText("VÁLIDO EN PRODUCTOS SELECCIONADOS.")).toBe("VALIDO EN PRODUCTOS SELECCIONADOS");
    expect(exclusionText("Descuento no cumulativo. No válido para vinos. No participan ofertas. No aplica a electro.")).toBe(
      "DESCUENTO NO CUMULATIVO|NO VALIDO PARA VINOS|NO PARTICIPAN OFERTAS|NO APLICA A ELECTRO",
    );
    expect(exclusionText("Exclusivo para compras online. Promoción exclusiva para socios.")).toBe("");
  });

  it("los días y meses no cambian la huella", () => {
    const day = (d) => `Promo del ${d}. No acumulable con otras promociones del ${d}.`;
    expect(exclusionText(day("MARTES 27 DE OCTUBRE"))).toBe("NO ACUMULABLE CON OTRAS PROMOCIONES DEL DE");
    expect(hashOf(exclusionText(day("MARTES 27 DE OCTUBRE")))).toBe(hashOf(exclusionText(day("MIERCOLES 11 DE NOVIEMBRE"))));
  });

  it("hashOf es FNV-1a de 32 bits en 8 caracteres hexadecimales", () => {
    expect(hashOf("")).toBe("811c9dc5");
    expect(hashOf("a")).toBe("e40c292c");
    expect(hashOf("foobar")).toBe("bf9cf968");
  });
});

describe("statusOf y excluded", () => {
  it("sigue el orden: sin tarjeta, sin número, huella desconocida, ok", () => {
    expect(statusOf({ bankLabel: "Z", percent: 20, legal: A }, rules)).toBe("unmapped");
    expect(statusOf({ bankLabel: "X", percent: null, legal: A }, rules)).toBe("unclear");
    expect(statusOf({ bankLabel: "X", percent: 20, legal: C }, rules)).toBe("changed");
    expect(statusOf({ bankLabel: "X", percent: 20, legal: B }, rules)).toBe("ok");
  });

  it("sin tope leído (capKnown false) es unclear", () => {
    expect(statusOf({ bankLabel: "X", percent: 20, capKnown: false, legal: A }, rules)).toBe("unclear");
    expect(statusOf({ bankLabel: "X", percent: 20, capKnown: true, legal: A }, rules)).toBe("ok");
  });

  it("una promo solo en productos seleccionados no es ok aunque las reglas conozcan el texto vacío", () => {
    const empty = { cardOf: () => ({ cardId: "modo", plan: null }), exclusions: [{ hash: hashOf(""), test: () => false }] };
    expect(statusOf({ percent: 10, legal: "VÁLIDO EN PRODUCTOS SELECCIONADOS." }, empty)).toBe("changed");
    expect(statusOf({ percent: 10, legal: "Válido los martes." }, empty)).toBe("ok");
  });

  it("excluded usa el test de la huella; sin huella conocida excluye todo", () => {
    expect(excluded({ legal: A }, rules, product("carne picada"))).toBe(true);
    expect(excluded({ legal: A }, rules, product("detergente"))).toBe(false);
    expect(excluded({ legal: C }, rules, product("detergente"))).toBe(true);
  });

  it("promoEntries arma { promo, ref, status } con las reglas del súper", () => {
    const promo = { bankLabel: "Modo", title: "Desde APP MODO o APP de bancos adheridos", percent: 20, capKnown: true, legal: "" };
    expect(promoEntries("mas", [promo])).toEqual([{ promo, ref: { cardId: "modo", plan: null }, status: "ok" }]);
    expect(promoEntries("mas", [{ ...promo, legal: "Solo productos seleccionados." }])[0].status).toBe("changed");
    expect(promoEntries("mas", "error")).toBe("error");
  });
});

const mas = parseMas(JSON.parse(readFileSync("tests/fixtures/bank-mas.json", "utf8"))).filter((p) => p.online);
const dia = parseDia(readFileSync("tests/fixtures/bank-dia.html", "utf8")).filter((p) => p.online);
const knownCard = (ref) => ref === null || CARDS.some((c) => c.id === ref.cardId && (ref.plan === null || c.plans.some((p) => p.id === ref.plan)));

describe("reglas de Más (captura 2026-11-12)", () => {
  const masClub = mas.find((p) => p.bankLabel === "MasClub");
  const modo = mas.find((p) => p.bankLabel === "Modo");

  it("toda promo online con porcentaje queda ok", () => {
    expect(mas).toHaveLength(2);
    expect(statusOf(masClub, RULES.mas)).toBe("ok");
    expect(statusOf(modo, RULES.mas)).toBe("ok");
    expect(RULES.mas.cardOf(masClub)).toEqual({ cardId: "masclub", plan: null });
    expect(RULES.mas.cardOf(modo)).toEqual({ cardId: "modo", plan: null });
  });

  it("no confunde un banco que paga con MODO con la billetera MODO", () => {
    expect(RULES.mas.cardOf({ bankLabel: "ICBC Modo", title: "Con tarjetas de crédito y débito" })).toBe(null);
    expect(RULES.mas.cardOf({ bankLabel: "BNA+MODO", title: "Con App MODO o App BNA+" })).toBe(null);
  });

  it("MasClub online excluye cada rubro y marca del legal", () => {
    const ex = (name, o) => excluded(masClub, RULES.mas, product(name, o));
    expect(ex("leche entera la serenisima 1 l", { brand: "la serenisima", groups: ["catv00001255", "catv00001295", "catv00003266", "catv00003282"] })).toBe(true);
    expect(ex("leche descremada larga vida 1 l")).toBe(true);
    expect(ex("gaseosa coca-cola sabor original 2,25 l", { brand: "coca-cola", groups: ["catv00001256", "catv00001301"] })).toBe(true);
    expect(ex("bife de chorizo x kg", { groups: ["catv00001255", "catv00001292"] })).toBe(true);
    expect(ex("queso cremoso la paulina x kg")).toBe(true);
    expect(ex("banana ecuador x kg", { groups: ["catv00003285"] })).toBe(true);
    expect(ex("huevos blancos x 12")).toBe(true);
    expect(ex("aceite de oliva natura 500 ml")).toBe(true);
    expect(ex("vinagre de alcohol menoyo 500 ml")).toBe(true);
    expect(ex("mayonesa hellmanns 237 g", { groups: ["catv00002211"] })).toBe(true);
    expect(ex("harina 000 blancaflor 1 kg")).toBe(true);
    expect(ex("azucar ledesma 1 kg")).toBe(true);
    expect(ex("pan de molde lactal fargo 600 g")).toBe(true);
    expect(ex("tortillas de trigo rapiditas x 10")).toBe(true);
    expect(ex("fernet branca 750 ml")).toBe(true);
    expect(ex("vino tinto malbec 750 ml", { groups: ["catv00001300"] })).toBe(true);
    expect(ex("cerveza rubia 473 ml", { brand: "quilmes" })).toBe(true);
    expect(ex("gaseosa pepsi 1,5 l", { brand: "pepsi" })).toBe(true);
    expect(ex("agua mineral eco de los andes 2 l")).toBe(true);
    expect(ex("agua bonaqua 1,5 l")).toBe(true);
    expect(ex("bebida energizante 473 ml", { brand: "monster" })).toBe(true);
    expect(ex("merluza filet congelado", { groups: ["catv00003240"] })).toBe(true);
    expect(ex("pechuga de pollo x kg", { groups: ["catv00001462"] })).toBe(true);
    expect(ex("smart tv 43", { groups: ["catv00001990"] })).toBe(true);
    expect(ex("bicicleta rodado 26", { groups: ["catv00002061"] })).toBe(true);
    expect(ex("ibuprofeno 400 x 10", { groups: ["catv00001309"] })).toBe(true);
    // No acumulable con otras promociones: lo que está en oferta en Más queda afuera.
    expect(ex("galletitas oreo 118 g", { onSale: true })).toBe(true);
  });

  it("MasClub online no excluye lo que el legal no nombra", () => {
    expect(excluded(masClub, RULES.mas, product("detergente magistral limon 500 ml", { brand: "magistral", groups: ["catv00003038"] }))).toBe(false);
    expect(excluded(masClub, RULES.mas, product("galletitas oreo 118 g", { brand: "oreo" }))).toBe(false);
    expect(excluded(masClub, RULES.mas, product("dulce de leche la serenisima 400 g"))).toBe(false);
  });

  it("MODO online no excluye productos", () => {
    expect(excluded(modo, RULES.mas, product("gaseosa coca-cola 2,25 l", { brand: "coca-cola" }))).toBe(false);
  });
});

describe("reglas de Día (captura 2026-11-12)", () => {
  // Estado esperado de cada promo online. Las que no son "ok" dicen por qué en src/bank-rules/dia.js.
  const expected = {
    "Personal Pay": ["ok", { cardId: "personalpay", plan: null }],
    "20% - MODO": ["ok", { cardId: "modo", plan: null }],
    "Mercado Pago 10%": ["changed", { cardId: "mercadopago", plan: null }], // "productos seleccionados": no se traduce
    "Columbia 20% de reintegro": ["unmapped", null], // el legal dice "en las sucursales"
    "Banco del Sol": ["changed", { cardId: "bancodelsol", plan: null }], // "programas gubernamentales" no se traduce
    "3CSI TC": ["unmapped", null], // cuotas con cualquier Visa: no es una tarjeta de la lista
    "3CI - Naranja": ["unclear", { cardId: "naranjax", plan: null }],
    "Naranja 20%": ["ok", { cardId: "naranjax", plan: "inicial" }],
    "Naranja 25%": ["ok", { cardId: "naranjax", plan: "turbo" }],
    "Naranja 30%": ["ok", { cardId: "naranjax", plan: "epico" }],
    "Mercado Pago 3 CSI": ["unclear", { cardId: "mercadopago", plan: null }],
    "BNA + MODO": ["unclear", { cardId: "nacion", plan: null }],
  };

  it("cada promo online tiene el estado y la tarjeta esperados", () => {
    expect(dia.map((p) => p.id).sort()).toEqual(Object.keys(expected).sort());
    for (const p of dia) {
      const [status, ref] = expected[p.id];
      expect([p.id, statusOf(p, RULES.dia)]).toEqual([p.id, status]);
      expect([p.id, RULES.dia.cardOf(p)]).toEqual([p.id, ref]);
      expect(knownCard(RULES.dia.cardOf(p))).toBe(true);
    }
  });

  it("Naranja sin plan claro no se asigna", () => {
    expect(RULES.dia.cardOf({ bankLabel: "Naranja", title: "Naranja 40%", percent: 40, legal: "" })).toBe(null);
  });

  it("las promos ok de Día no excluyen productos", () => {
    for (const p of dia.filter((x) => statusOf(x, RULES.dia) === "ok")) {
      expect(excluded(p, RULES.dia, product("gaseosa coca-cola 2,25 l", { brand: "coca-cola", onSale: true }))).toBe(false);
    }
  });
});

describe("reglas de Carrefour", () => {
  it("sin fuente legible: ninguna promo se asigna", () => {
    expect(RULES.carrefour.cardOf({ bankLabel: "Carrefour Banco", title: "x", percent: 20 })).toBe(null);
    expect(RULES.carrefour.exclusions).toEqual([]);
  });
});

describe("cada regla tiene fuente", () => {
  it("toda exclusión dice su fuente y tiene test", () => {
    for (const id of ["mas", "dia"]) {
      expect(RULES[id].exclusions.length).toBeGreaterThan(0);
      for (const e of RULES[id].exclusions) {
        expect(e.hash).toMatch(/^[0-9a-f]{8}$/);
        expect(e.source).toMatch(/^https:\/\/.+ \(\d{4}-\d{2}-\d{2}\)$/);
        expect(typeof e.test).toBe("function");
      }
    }
  });
});
