import { describe, it, expect } from "vitest";
import { cartNutrition, cartNutritionRows } from "../src/nutrition-cart.js";

const N = (per100) => ({ per100 });
// Dos productos con datos, uno sin tabla, uno que no es comida (no cuenta), uno sin tamaño.
const LINES = [
  { ean: "1", nutri: true, qty: 2, amount: 0.5 }, // 2 × 500 g
  { ean: "2", nutri: true, qty: 1, amount: 1.5 }, // 1,5 L
  { ean: "3", nutri: true, qty: 1, amount: 0.4 }, // sin tabla
  { ean: "4", nutri: false, qty: 3, amount: 0.09 }, // jabón: no cuenta
  { ean: "5", nutri: true, qty: 1, amount: null }, // sin tamaño
];
const RESULTS = new Map([
  ["1", N({ kcal: 350, sugars: 2, sodiumMg: 5 })],
  ["2", N({ kcal: 42, sugars: 10.6, sodiumMg: 10 })],
  ["3", "missing"],
  ["5", N({ kcal: 100 })],
]);

describe("cartNutrition", () => {
  it("suma cada 100 × tamaño × cantidad, solo con tabla y tamaño", () => {
    expect(cartNutrition(LINES, RESULTS)).toEqual({ kcal: 3500 + 630, sugars: 20 + 159, sodiumMg: 50 + 150, counted: 2, total: 4 });
  });
  it("sin ningún producto con datos: null", () => {
    expect(cartNutrition(LINES, new Map())).toBeNull();
    expect(cartNutrition([], RESULTS)).toBeNull();
  });
});

describe("cartNutritionRows", () => {
  it("una línea con el total y otra con los productos sin datos", () => {
    expect(cartNutritionRows({ kcal: 4130, sugars: 179, sodiumMg: 200, counted: 2, total: 4 })).toEqual([
      { kind: "nutri", text: "Tu compra: 4.130 kcal · 179 g de azúcares · 0,2 g de sodio" },
      { kind: "nutri-note", text: "2 de 4 productos sin datos nutricionales" },
    ]);
  });
  it("todos con datos: sin la segunda línea; null: sin filas", () => {
    expect(cartNutritionRows({ kcal: 1000, sugars: 5, sodiumMg: 1200, counted: 3, total: 3 })).toEqual([
      { kind: "nutri", text: "Tu compra: 1.000 kcal · 5 g de azúcares · 1,2 g de sodio" },
    ]);
    expect(cartNutritionRows(null)).toEqual([]);
  });
});

it("un producto al que le falta azúcar o sodio no se suma: cuenta como sin datos", () => {
  const lines = [{ ean: "1", nutri: true, qty: 1, amount: 1 }, { ean: "6", nutri: true, qty: 1, amount: 1 }];
  const results = new Map([["1", N({ kcal: 100, sugars: 1, sodiumMg: 10 })], ["6", N({ kcal: 500 })]]);
  expect(cartNutrition(lines, results)).toEqual({ kcal: 1000, sugars: 10, sodiumMg: 100, counted: 1, total: 2 });
});
