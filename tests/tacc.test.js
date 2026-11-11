import { describe, it, expect } from "vitest";
import { taccFromSearch, withTaccFilter, taccStatus } from "../src/tacc.js";

const ID = "prod00508911";
const body = (ids, options) => ({
  response: {
    results: ids.map((id) => ({ data: { id } })),
    facets: options ? [{ name: "SIN TACC", options: options.map(([value, count]) => ({ value, count })) }] : [],
  },
});

describe("taccFromSearch", () => {
  it("un solo resultado: lee la faceta SIN TACC", () => {
    expect(taccFromSearch(body([ID], [["SI", 1]]), ID)).toBe("SI");
    expect(taccFromSearch(body([ID], [["NO", 1]]), ID)).toBe("NO");
    expect(taccFromSearch(body([ID], null), ID)).toBeNull();
  });
  it("varios resultados: no se puede saber con la faceta (undefined)", () => {
    expect(taccFromSearch(body([ID, "prod00000001"], [["SI", 1], ["NO", 1]]), ID)).toBeUndefined();
  });
  it("el producto no está o no hay respuesta: null", () => {
    expect(taccFromSearch(body(["prod00000001"], [["SI", 1]]), ID)).toBeNull();
    expect(taccFromSearch(null, ID)).toBeNull();
  });
});

it("withTaccFilter suma el filtro a la búsqueda", () => {
  const u = withTaccFilter("https://api.coto.com.ar/x/products/search/508911?key=k&num_results_per_page=24", "SI");
  expect(new URL(u).searchParams.get("filters[SIN TACC]")).toBe("SI");
  expect(new URL(u).searchParams.get("key")).toBe("k");
});

describe("taccStatus", () => {
  const n = (extra = {}) => ({ ingredients: null, allergens: [], glutenFreeLabel: false, ...extra });

  it("Coto SI sin riesgo: ok", () => {
    expect(taccStatus("SI", "Leche Protein La Serenisima 1L", n())).toEqual({ kind: "ok", text: "Coto lo marca Sin TACC" });
  });
  it("Coto SI con un cereal con gluten en el nombre o los ingredientes: advertencia", () => {
    expect(taccStatus("SI", "Avena Tradicional Sturla 350g", n())).toEqual({ kind: "warn", text: "Coto lo marca Sin TACC, pero menciona avena. Revisá el envase." });
    expect(taccStatus("SI", "Galletitas", n({ ingredients: { text: "Harina de TRIGO enriquecida", spanish: true } })).text).toContain("menciona trigo");
  });
  it("Coto SI pero OFF declara gluten: advertencia", () => {
    expect(taccStatus("SI", "Galletitas", n({ allergens: ["gluten"] }))).toEqual({ kind: "warn", text: "Coto lo marca Sin TACC, pero declara gluten. Revisá el envase." });
  });
  it("trigo sarraceno no cuenta como riesgo", () => {
    expect(taccStatus("SI", "Harina De Trigo Sarraceno Integral Dicomere 450g", n()).kind).toBe("ok");
  });
  it("Coto NO: no figura (nunca 'contiene gluten')", () => {
    expect(taccStatus("NO", "Mostaza NATURA Pouch 250 Gr", n({ glutenFreeLabel: true }))).toEqual({ kind: "no", text: "No figura como Sin TACC en Coto" });
  });
  it("sin dato de Coto: OFF libre y sin riesgo; si no, sin dato", () => {
    expect(taccStatus(null, "Arroz Gallo", n({ glutenFreeLabel: true }))).toEqual({ kind: "ok", text: "Sin TACC según Open Food Facts" });
    expect(taccStatus(null, "Galletitas de avena", n({ glutenFreeLabel: true }))).toEqual({ kind: "unknown", text: "Sin dato de TACC" });
    expect(taccStatus(null, "Arroz Gallo", n())).toEqual({ kind: "unknown", text: "Sin dato de TACC" });
    expect(taccStatus(null, "Arroz Gallo", null)).toEqual({ kind: "unknown", text: "Sin dato de TACC" });
  });
});
