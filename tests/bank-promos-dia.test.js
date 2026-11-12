import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { diaCards, parseDia } from "../src/bank-promos/dia.js";

const html = (cards) => `<script>{"x":{"cards":[{"image":"a"}]},"y":{"bankTabText":"Ver por banco","cards":${JSON.stringify(cards)}}}</script>`;
const card = (o) => ({ __editorItemTitle: "X", active: true, daysToShow: { monday: true, all: true }, availableOn: { online: true }, associatedBanks: [{ __editorItemTitle: "Banco Columbia" }], terms: "", ...o });
const NX = "(1) PLAN INICIAL: 20% DE DESCUENTO CON TOPE DE $3.000 POR SEMANA. (2) PLAN TURBO: 25% DE DESCUENTO CON TOPE DE $9.500 POR SEMANA. (3) PLAN ÉPICO: 30% DE DESCUENTO CON TOPE DE $12.000 POR SEMANA.";

describe("diaCards", () => {
  it("se queda con el array más largo que tiene terms", () => {
    const cards = [card({ terms: "a" }), card({ terms: "b" })];
    expect(diaCards(html(cards))).toHaveLength(2);
  });
  it("respeta corchetes dentro de textos", () => {
    const cards = [card({ terms: "texto ] con [ corchetes \" y comillas" })];
    expect(diaCards(html(cards))[0].terms).toContain("corchetes");
  });
  it("devuelve [] si no hay", () => {
    expect(diaCards("<html></html>")).toEqual([]);
  });
});

describe("parseDia", () => {
  it("porcentaje del título, tope por transacción, día y banco", () => {
    expect(parseDia(html([card({ __editorItemTitle: "Columbia 20% de reintegro", terms: "20% DE AHORRO EN COMPRAS EN UN PAGO, TOPE DE REINTEGRO $10.000 (DIEZ MIL PESOS) POR TRANSACCION." })]))[0])
      .toMatchObject({ store: "dia", bankLabel: "Banco Columbia", percent: 20, cap: 10000, capPeriod: "tx", days: [1], online: true, direct: false, from: null, to: null });
  });
  it("cada plan de Naranja toma su tope", () => {
    expect(parseDia(html([card({ __editorItemTitle: "Naranja 25%", terms: NX })]))[0]).toMatchObject({ percent: 25, cap: 9500, capPeriod: "week" });
  });
  it("sin tope y mínimo de compra", () => {
    expect(parseDia(html([card({ __editorItemTitle: " Personal Pay", terms: "UN 15% (QUINCE POR CIENTO) DE REINTEGRO, SIN TOPE DE REINTEGRO, CON UN MÍNIMO DE COMPRA DE $20.000." })]))[0]).toMatchObject({ percent: 15, cap: null, minPurchase: 20000 });
  });
  it("percent null si no hay porcentaje de reintegro", () => {
    expect(parseDia(html([card({ __editorItemTitle: "3CSI TC", terms: "TEM: 0,00% - TNA: 0,00%" })]))[0].percent).toBe(null);
  });
  it("varios porcentajes en terms sin título: null", () => {
    expect(parseDia(html([card({ terms: "10% DE REINTEGRO Y 20% DE DESCUENTO" })]))[0].percent).toBe(null);
  });
  it("pago mínimo y días en orden", () => {
    const p = parseDia(html([card({ daysToShow: { saturday: true, sunday: true, wednesday: true }, terms: "PAGO MÍNIMO DE $5.000." })]))[0];
    expect(p.minPurchase).toBe(5000);
    expect(p.days).toEqual([0, 3, 6]);
  });
  it("sin banco asociado usa el título; offline", () => {
    const p = parseDia(html([card({ __editorItemTitle: "Promo Z", associatedBanks: [], availableOn: { online: false } })]))[0];
    expect(p).toMatchObject({ bankLabel: "Promo Z", online: false });
  });
  it("descarta inactivas y HTML vacío", () => {
    expect(parseDia(html([card({ active: false })]))).toEqual([]);
    expect(parseDia("<html></html>")).toEqual([]);
  });
  it("humo con el fixture real", () => {
    const fx = readFileSync(new URL("./fixtures/bank-dia.html", import.meta.url), "utf8");
    const out = parseDia(fx);
    expect(out.length).toBeGreaterThan(5);
    for (const p of out) expect(p.store).toBe("dia");
  });
});
