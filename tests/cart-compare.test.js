import { describe, it, expect } from "vitest";
import { compareCart } from "../src/cart-compare.js";
import { hashOf } from "../src/bank-rules/hash.js";

const DIA = [{ id: "dia", name: "Día" }];
const TUE = 2, WED = 3;
const CARDS = { naranjax: { plan: "turbo" } };

const line = (ean, name, total, extra = {}) => ({
  ean, name, qty: 1, total, cmp: ean ? { unit: total, qty: 1 } : null,
  bankEligible: true, brand: "", groups: [], ...extra,
});

// 4 líneas: 1000, 2000, 3000 (sin banco en Coto) y 4000 sin EAN.
const LINES = [
  line("1", "Yerba Mañanita", 1000, { brand: "Mañanita", groups: ["almacen"] }),
  line("2", "Fideos", 2000),
  line("3", "Vino", 3000, { bankEligible: false }),
  line(null, "Pan", 4000),
];
const analysis = (extra = {}) => ({ lines: LINES, total: 10000, today: { promo: { bank: "ICBC", percent: 20, cap: 500 } }, ...extra });

const LINE_RESULTS = { 1: { total: 900, onSale: false, url: "u1" }, 2: { total: 1900, onSale: true, url: "u2" }, 3: { total: 2800, onSale: false, url: "u3" } };
const results = (lines = LINE_RESULTS) => ({ dia: { at: 1234, lines } });

// Reglas de prueba: la tarjeta va en la promo; con legal vacío no se excluye nada salvo la marca "excluida".
const RULES = {
  dia: {
    cardOf: (p) => p.card ?? null,
    exclusions: [{ hash: hashOf(""), test: (prod) => prod.brand === "excluida" }],
  },
};
const promo = (extra = {}) => ({
  id: "p1", store: "dia", bankLabel: "Naranja X", title: "Turbo 25%", percent: 25, cap: 9500, capKnown: true,
  capPeriod: null, minPurchase: null, days: [TUE], from: null, to: null, online: true, direct: false, legal: "",
  card: { cardId: "naranjax", plan: "turbo" }, ...extra,
});

const run = (over = {}) => compareCart({
  analysis: analysis(), results: results(), promos: { dia: [promo()] }, cards: CARDS, day: TUE, stores: DIA, rules: RULES, ...over,
});

describe("compareCart: productos en común", () => {
  it("faltantes: sin ean, missing y dato dudoso", () => {
    const r = run({ results: results({ ...LINE_RESULTS, 2: "missing", 3: { total: 100, onSale: false, url: "u3" } }) });
    const st = r.stores[0];
    expect(st).toMatchObject({ id: "dia", name: "Día", state: "ok", at: 1234, matched: 1, of: 4 });
    expect(st.common).toEqual([{ ean: "1", name: "Yerba Mañanita", coto: 1000, other: 900, url: "u1" }]);
    expect(st.missing).toEqual([{ ean: "2", name: "Fideos" }, { ean: "3", name: "Vino" }, { ean: null, name: "Pan" }]);
  });

  it("dato dudoso arriba de 2,5 veces y precio cero también faltan", () => {
    const r = run({ results: results({ ...LINE_RESULTS, 2: { total: 5001, onSale: false, url: "u2" }, 3: { total: 0, onSale: false, url: "u3" } }) });
    expect(r.stores[0].matched).toBe(1);
  });

  it("líneas con cantidad 0 no cuentan", () => {
    const r = run({ analysis: analysis({ lines: [...LINES, line("9", "Nada", 0, { qty: 0 })] }) });
    expect(r.stores[0].of).toBe(4);
  });

  it("sin banco: suma de los dos lados y diferencia", () => {
    const st = run().stores[0];
    expect(st).toMatchObject({ matched: 3, of: 4, coto: 6000, other: 5600, diff: -400 });
  });

  it("súper con error: state error y no compite", () => {
    const r = run({ results: { dia: "error" } });
    expect(r.stores[0]).toMatchObject({ id: "dia", state: "error" });
    expect(r.verdict).toEqual({ winner: null });
  });

  it("sin productos en común: state empty", () => {
    const r = run({ results: results({ 1: "missing", 2: "missing", 3: "missing" }) });
    expect(r.stores[0]).toMatchObject({ state: "empty", matched: 0, of: 4 });
    expect(r.verdict).toEqual({ winner: null });
  });
});

describe("compareCart: con tarjetas", () => {
  it("bankCoto: solo las comunes que aceptan banco, con tope", () => {
    expect(run().stores[0].bankCoto).toEqual({ label: "ICBC 20%", saving: 500, total: 5500 });
  });

  it("bankCoto: null sin promo de Coto hoy", () => {
    expect(run({ analysis: analysis({ today: null }) }).stores[0].bankCoto).toBeNull();
  });

  it("bankOther: la promo ok del día para tus tarjetas", () => {
    const st = run().stores[0];
    expect(st.bankOther).toEqual({ label: "Naranja X 25%", saving: 1400, total: 4200 });
    expect(st.bankNote).toBeNull();
    expect(st.minLeft).toBeNull();
  });

  it("bankOther: elige la promo por el día de compra, no por hoy", () => {
    const st = run({ day: WED }).stores[0];
    expect(st.bankOther).toBeNull();
    expect(st.bankNote).toBe("none");
  });

  it("bankOther: con tope", () => {
    expect(run({ promos: { dia: [promo({ cap: 1000 })] } }).stores[0].bankOther).toMatchObject({ saving: 1000, total: 4600 });
  });

  it("bankOther: sin tope (cap null) usa todo lo elegible", () => {
    expect(run({ promos: { dia: [promo({ cap: null })] } }).stores[0].bankOther).toMatchObject({ saving: 1400 });
  });

  it("bankOther: elige la de mayor ahorro", () => {
    const st = run({ promos: { dia: [promo({ id: "a", percent: 10, title: "10%" }), promo({ id: "b", percent: 30, bankLabel: "Naranja" })] } }).stores[0];
    expect(st.bankOther).toEqual({ label: "Naranja 30%", saving: 1680, total: 3920 });
  });

  it("bankOther: promo de otra tarjeta no aplica", () => {
    const st = run({ cards: { icbc: { plan: null } } }).stores[0];
    expect(st.bankOther).toBeNull();
    expect(st.bankNote).toBe("none");
  });

  it("compra mínima no alcanzada: bankNote min y cuánto falta", () => {
    const st = run({ promos: { dia: [promo({ minPurchase: 75000 })] } }).stores[0];
    expect(st.bankOther).toBeNull();
    expect(st.bankNote).toBe("min");
    expect(st.minLeft).toBe(69400);
  });

  it("compra mínima alcanzada: aplica", () => {
    expect(run({ promos: { dia: [promo({ minPurchase: 5600 })] } }).stores[0].bankOther).toMatchObject({ saving: 1400 });
  });

  it("promo de tu tarjeta con términos cambiados: bankNote changed", () => {
    const st = run({ promos: { dia: [promo({ legal: "Excluye bebidas alcoholicas." })] } }).stores[0];
    expect(st.bankOther).toBeNull();
    expect(st.bankNote).toBe("changed");
  });

  it("promo dudosa (sin porcentaje) no se resta", () => {
    const st = run({ promos: { dia: [promo({ percent: null })] } }).stores[0];
    expect(st.bankOther).toBeNull();
    expect(st.bankNote).toBe("none");
  });

  it("promos con error: bankNote error y el veredicto usa el precio sin banco", () => {
    const r = run({ promos: { dia: "error" } });
    expect(r.stores[0].bankOther).toBeNull();
    expect(r.stores[0].bankNote).toBe("error");
    // 5600 contra 5500 de Coto con ICBC: gana Coto por 100.
    expect(r.verdict).toEqual({ winner: "coto", saving: 100, withCards: true, runnerUp: "dia" });
  });

  it("sin promos pedidas para el súper (undefined): bankNote none, no error", () => {
    const st = run({ promos: {} }).stores[0];
    expect(st.bankOther).toBeNull();
    expect(st.bankNote).toBe("none");
  });

  it("una promo que no ahorra nada (todo excluido) es como no tener promo", () => {
    const lines = LINES.map((l) => (l.ean ? { ...l, brand: "EXCLUIDA" } : l));
    const st = run({ analysis: analysis({ lines }) }).stores[0];
    expect(st.bankOther).toBeNull();
    expect(st.bankNote).toBe("none");
  });

  it("promo con ahorro 0 y otra bloqueada por la compra mínima: bankNote min", () => {
    const lines = LINES.map((l) => (l.ean ? { ...l, brand: "EXCLUIDA" } : l));
    const promos = { dia: [promo({ id: "a" }), promo({ id: "b", minPurchase: 75000 })] };
    const st = run({ analysis: analysis({ lines }), promos }).stores[0];
    expect(st.bankOther).toBeNull();
    expect(st.bankNote).toBe("min");
    expect(st.minLeft).toBe(69400);
  });

  it("una línea excluida por las reglas no entra en elegible", () => {
    const lines = LINES.map((l) => (l.ean === "2" ? { ...l, brand: "EXCLUIDA" } : l));
    const st = run({ analysis: analysis({ lines }) }).stores[0];
    // Elegible: 900 + 2800 = 3700 → 925.
    expect(st.bankOther).toEqual({ label: "Naranja X 25%", saving: 925, total: 4675 });
  });

  it("las reglas reciben nombre y marca sin acentos, grupos y si está en oferta", () => {
    const seen = [];
    const rules = { dia: { ...RULES.dia, exclusions: [{ hash: hashOf(""), test: (p) => (seen.push(p), false) }] } };
    run({ rules });
    expect(seen[0]).toEqual({ name: "yerba mananita", brand: "mananita", groups: ["almacen"], onSale: false });
    expect(seen[1].onSale).toBe(true);
  });

  it("con las reglas reales de Día", () => {
    const real = promo({ bankLabel: "Naranja", title: "Plan Turbo 25%", card: undefined });
    const st = compareCart({ analysis: analysis(), results: results(), promos: { dia: [real] }, cards: CARDS, day: TUE, stores: DIA }).stores[0];
    expect(st.bankOther).toMatchObject({ saving: 1400, total: 4200 });
  });
});

describe("compareCart: veredicto", () => {
  it("con tarjetas Día gana por 1300", () => {
    expect(run().verdict).toEqual({ winner: "dia", saving: 1300, withCards: true, runnerUp: "coto" });
  });

  it("sin tarjetas compara sin banco: Día gana por 400", () => {
    const r = run({ cards: {} });
    expect(r.stores[0].bankOther).toBeNull();
    expect(r.verdict).toEqual({ winner: "dia", saving: 400, withCards: false, runnerUp: "coto" });
  });

  it("diferencia de 0,5%: gana Coto", () => {
    const r = run({ cards: {}, results: results({ 1: { total: 995, onSale: false }, 2: { total: 1990, onSale: false }, 3: { total: 2985, onSale: false } }) });
    expect(r.verdict).toEqual({ winner: "coto", saving: 0, withCards: false, runnerUp: "dia" });
  });

  it("Coto gana por la menor diferencia a su favor", () => {
    const stores = [{ id: "dia", name: "Día" }, { id: "mas", name: "Más" }];
    const r = run({
      cards: {}, stores, promos: {},
      results: {
        dia: { at: 1, lines: { 1: { total: 1100 }, 2: { total: 2100 }, 3: { total: 3100 } } },
        mas: { at: 1, lines: { 1: { total: 1000 }, 2: { total: 2000 }, 3: { total: 3050 } } },
      },
    });
    expect(r.verdict).toEqual({ winner: "coto", saving: 50, withCards: false, runnerUp: "mas" });
  });

  it("runnerUp cuando gana Coto: solo entre los súper que compiten", () => {
    const stores = [{ id: "mas", name: "Más" }, { id: "dia", name: "Día" }];
    const r = run({
      cards: {}, stores, promos: {},
      results: {
        // Más tiene un solo producto en común (menos de la mitad del carrito): no compite.
        mas: { at: 1, lines: { 1: { total: 1000 }, 2: "missing", 3: "missing" } },
        dia: { at: 1, lines: { 1: { total: 1100 }, 2: { total: 2100 }, 3: { total: 3100 } } },
      },
    });
    expect(r.verdict).toEqual({ winner: "coto", saving: 300, withCards: false, runnerUp: "dia" });
  });

  it("gana el súper que más ahorra", () => {
    const stores = [{ id: "dia", name: "Día" }, { id: "mas", name: "Más" }];
    const r = run({
      cards: {}, stores, promos: {},
      results: { dia: results().dia, mas: { at: 1, lines: { 1: { total: 800 }, 2: { total: 1800 }, 3: { total: 2700 } } } },
    });
    expect(r.verdict).toEqual({ winner: "mas", saving: 700, withCards: false, runnerUp: "coto" });
  });

  it("súper con menos de la mitad del carrito en común no compite", () => {
    const r = run({ analysis: analysis({ total: 12001 }) });
    expect(r.stores[0].state).toBe("ok");
    expect(r.verdict).toEqual({ winner: null });
  });
});
