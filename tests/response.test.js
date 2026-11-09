import { describe, it, expect } from "vitest";
import {
  UNIT_SORT_OPTION, isProductsUrl, isUnitSort, toNativeSort, cacheKey,
  pageUrl, requestedPage, withSortOption, withResults, storeOf,
} from "../src/response.js";

const API = "https://api.coto.com.ar/api/v1/ms-digital-sitio-bff-web/api/v1/products/";
const u = API + "categories/catv00001869?sort_by=unit_price&sort_order=ascending&page=3&num_results_per_page=24&us=200&us=200&i=abc&s=1&filters=x";

describe("URLs", () => {
  it("detecta pedidos de productos", () => {
    expect(isProductsUrl(API + "search/aceite?x=1")).toBe(true);
    expect(isProductsUrl(u)).toBe(true);
    expect(isProductsUrl(API + "recommendations/popular-searches")).toBe(false);
    expect(isProductsUrl("/relative/products/categories/x")).toBe(true);
  });

  it("detecta y traduce el orden por unidad", () => {
    expect(isUnitSort(u)).toBe(true);
    expect(isUnitSort(u.replace("unit_price", "price"))).toBe(false);
    const native = new URL(toNativeSort(u)).searchParams;
    expect(native.get("sort_by")).toBe("price");
    expect(native.get("sort_order")).toBe("ascending");
    expect(native.get("page")).toBe("3");
  });

  it("la llave de caché ignora página, tamaño y sesión pero no los filtros", () => {
    expect(cacheKey(u)).toBe(cacheKey(u.replace("page=3", "page=1").replace("i=abc", "i=zzz").replace("s=1", "s=2")));
    expect(cacheKey(u)).not.toBe(cacheKey(u.replace("filters=x", "filters=y")));
  });

  it("lee página, tamaño y sucursal", () => {
    expect(requestedPage(u)).toEqual({ page: 3, size: 24 });
    expect(requestedPage(API + "search/x")).toEqual({ page: 1, size: 24 });
    expect(storeOf(u)).toBe("200");
    expect(storeOf(API + "search/x")).toBe("200");
    expect(storeOf(API + "search/x?us=061")).toBe("061");
  });

  it("arma la URL de una tanda", () => {
    const p = new URL(pageUrl(u, 2, 200)).searchParams;
    expect(p.get("page")).toBe("2");
    expect(p.get("num_results_per_page")).toBe("200");
    expect(p.get("sort_by")).toBe("price");
  });
});

describe("respuestas", () => {
  const j = { response: { total_num_results: 50, sort_options: [{ sort_by: "price", status: "selected" }], results: [1, 2] } };

  it("agrega la opción una sola vez y la marca si corresponde", () => {
    const out = withSortOption(withSortOption(j, true), true);
    const mine = out.response.sort_options.filter((o) => o.sort_by === "unit_price");
    expect(mine).toHaveLength(1);
    expect(mine[0]).toEqual({ ...UNIT_SORT_OPTION, status: "selected" });
    expect(out.response.sort_options[0].status).toBe("");
    expect(j.response.sort_options).toHaveLength(1);
    const off = withSortOption(j, false);
    expect(off.response.sort_options[0].status).toBe("selected");
    expect(off.response.sort_options.at(-1).status).toBe("");
  });

  it("reemplaza resultados y mantiene el total", () => {
    const out = withResults(j, [9]);
    expect(out.response.results).toEqual([9]);
    expect(out.response.total_num_results).toBe(50);
    expect(j.response.results).toEqual([1, 2]);
  });

  it("la opción tiene el texto exacto", () => {
    expect(UNIT_SORT_OPTION).toEqual({
      sort_by: "unit_price", sort_order: "ascending",
      display_name: "Precio por kg/L: menor a mayor", hidden: false,
    });
  });
});

describe("v4: isCartUrl", () => {
  it("solo getCarrito, no getCarritoOrdenado", async () => {
    const { isCartUrl } = await import("../src/response.js");
    expect(isCartUrl("https://www.coto.com.ar/rest/model/atg/actors/cCarritoActor/getCarrito?grp=0&_t=1")).toBe(true);
    expect(isCartUrl("https://www.coto.com.ar/rest/model/atg/actors/cCarritoActor/getCarritoOrdenado?_t=1")).toBe(false);
  });
});
