import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { parseMas } from "../src/bank-promos/mas.js";

const banks = [{ id: "b1", name: "NaranjaX" }, { id: "b2", name: "Modo" }];
const row = (o) => ({ id: "1", active: true, ecommerce: false, tuesday: true, idBank: "b1", legal: "", ...o });

describe("parseMas", () => {
  it("lee porcentaje, tope semanal, día y banco", () => {
    const [p] = parseMas({ banks, promos: [row({ title: "Plan Turbo - Con Crédito NaranjaX o débito Visa", sub_title: "Tope: $9.500 semanal. (NX)", discount_percentage: 25, discount_text_info: "de reintegro" })] });
    expect(p).toMatchObject({ store: "mas", bankLabel: "NaranjaX", percent: 25, cap: 9500, capPeriod: "week", days: [2], online: false, direct: false });
  });

  it("lee tope mensual, mínimo de compra y online", () => {
    const [m] = parseMas({ banks, promos: [row({ idBank: "b2", ecommerce: true, wednesday: true, tuesday: false, discount_percentage: 20, sub_title: "Tope: $25.000 mensual por banco. Mínimo de compra: $75.000." })] });
    expect(m).toMatchObject({ online: true, cap: 25000, capPeriod: "month", minPurchase: 75000, days: [3] });
  });

  it("acepta ecommerce como texto y marca descuento directo", () => {
    const [p] = parseMas({ banks, promos: [row({ ecommerce: "true", discount_percentage: 10, discount_text_info: "de descuento" })] });
    expect(p).toMatchObject({ online: true, direct: true });
  });

  it("SIN TOPE da cap null", () => {
    expect(parseMas({ banks, promos: [row({ title: "SIN TOPE DE REINTEGRO", discount_percentage: 20 })] })[0].cap).toBe(null);
  });

  it("sin porcentaje da percent null", () => {
    expect(parseMas({ banks, promos: [row({ discount_percentage: null })] })[0].percent).toBe(null);
  });

  it("descarta filas inactivas y entradas inválidas", () => {
    expect(parseMas({ banks, promos: [row({ active: false })] })).toEqual([]);
    expect(parseMas(null)).toEqual([]);
  });

  it("humo con el fixture real", () => {
    const fx = JSON.parse(readFileSync(new URL("./fixtures/bank-mas.json", import.meta.url), "utf8"));
    const out = parseMas(fx);
    expect(out.length).toBeGreaterThan(0);
    for (const p of out) {
      expect(p.store).toBe("mas");
      expect(p.id).toBeTruthy();
    }
  });
});
