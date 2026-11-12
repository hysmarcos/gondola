import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { parseCarrefour } from "../src/bank-promos/carrefour.js";

describe("parseCarrefour", () => {
  it("HTML sin datos da null", () => {
    expect(parseCarrefour("<html></html>")).toBe(null);
  });
  it("el fixture real tampoco trae datos: null", () => {
    const fx = readFileSync(new URL("./fixtures/bank-carrefour.html", import.meta.url), "utf8");
    expect(parseCarrefour(fx)).toBe(null);
  });
});
