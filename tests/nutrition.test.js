import { describe, it, expect } from "vitest";
import { parseOff, isFood, nutriEligible, offProductUrl, offApiUrl } from "../src/nutrition.js";
import { OFF } from "./fixtures/off.js";

const off = (n100, extra = {}) => ({ status: 1, product: { nutriments: n100, ...extra } });

describe("parseOff", () => {
  it("Coca-Cola: tabla cada 100 y link a la ficha", () => {
    const n = parseOff(OFF["7790895000997"], "7790895000997");
    expect(n.per100.kcal).toBeGreaterThan(0);
    expect(n.url).toBe("https://world.openfoodfacts.org/product/7790895000997");
  });

  it("con valores por porción arma perServing", () => {
    const n = parseOff(OFF["7790040613706"], "7790040613706");
    expect(n.perServing).not.toBeNull();
    expect(Object.keys(n.perServing).length).toBeGreaterThan(0);
  });

  it("ficha sin tabla y producto inexistente dan missing", () => {
    expect(parseOff(OFF["7790040143524"], "7790040143524")).toBe("missing");
    expect(parseOff(OFF["7798078450393"], "7798078450393")).toBe("missing");
    expect(parseOff(null, "1")).toBe("missing");
  });

  it("sodio en g pasa a mg", () => {
    const n = parseOff(off({ "energy-kcal_100g": 50, fat_100g: 1, sodium_100g: 0.012 }), "1");
    expect(n.per100.sodiumMg).toBe(12);
  });

  it("menos de 3 nutrientes válidos da missing", () => {
    expect(parseOff(off({ "energy-kcal_100g": 50, fat_100g: 1 }), "1")).toBe("missing");
  });

  it("descarta negativos, más de 100 g, más de 900 kcal y texto no numérico; acepta '3.5'", () => {
    const n = parseOff(
      off({ "energy-kcal_100g": 950, fat_100g: -1, sugars_100g: 120, carbohydrates_100g: "3.5", proteins_100g: "abc", fiber_100g: 2, sodium_100g: 0.1, "trans-fat_100g": null }),
      "1",
    );
    expect(n.per100).toEqual({ carbs: 3.5, fiber: 2, sodiumMg: 100 });
  });

  it("sin valores _serving, perServing es null; servingSize tal como viene", () => {
    const n = parseOff(off({ "energy-kcal_100g": 50, fat_100g: 1, sugars_100g: 2 }, { serving_size: "30 g" }), "1");
    expect(n.perServing).toBeNull();
    expect(n.servingSize).toBe("30 g");
  });

  it("una porción puede pasar 100 g", () => {
    const n = parseOff(off({ "energy-kcal_100g": 50, fat_100g: 1, sugars_100g: 2, carbohydrates_serving: 150 }), "1");
    expect(n.perServing).toEqual({ carbs: 150 });
  });
});

describe("isFood / nutriEligible", () => {
  const g = (...ids) => ids.map((group_id) => ({ group_id }));

  it("comida y bebida sí; limpieza y perfumería no", () => {
    expect(isFood(g("catv00001254"))).toBe(true);
    expect(isFood(g("catv00001296", "catv00003146"))).toBe(true);
    expect(isFood(g("catv00001258"))).toBe(false);
    expect(isFood(g("catv00001257"))).toBe(false);
    expect(isFood(undefined)).toBe(false);
  });

  it("pesable no aplica aunque sea comida", () => {
    expect(nutriEligible({ groups: g("catv00001255"), product_weighable: 1 })).toBe(false);
    expect(nutriEligible({ groups: g("catv00001255"), product_unit_of_measure: "KGS" })).toBe(false);
    expect(nutriEligible({ groups: g("catv00001255"), product_weighable: 0 })).toBe(true);
  });

  it("URLs de la ficha y de la API", () => {
    expect(offProductUrl("123")).toBe("https://world.openfoodfacts.org/product/123");
    expect(offApiUrl("123").startsWith("https://world.openfoodfacts.org/api/v2/product/123?fields=product_name,nutriments,serving_size")).toBe(true);
  });
});

describe("primera ola: porción, fecha y fotos", () => {
  const off = (extra) => ({ status: 1, product: { nutriments: { "energy-kcal_100g": 50, fat_100g: 1, sugars_100g: 2 }, ...extra } });

  it("trae servingQty, updatedAt y las fotos de OFF", () => {
    const n = parseOff(off({
      serving_quantity: "30",
      last_modified_t: 1773000000,
      image_front_url: "https://images.openfoodfacts.org/images/products/1/front_es.4.400.jpg",
      image_nutrition_url: "https://images.openfoodfacts.org/images/products/1/nutrition_es.6.400.jpg",
    }), "1");
    expect(n.servingQty).toBe(30);
    expect(n.updatedAt).toBe(1773000000 * 1000);
    expect(n.photos).toEqual({
      front: "https://images.openfoodfacts.org/images/products/1/front_es.4.400.jpg",
      nutrition: "https://images.openfoodfacts.org/images/products/1/nutrition_es.6.400.jpg",
      ingredients: null,
    });
  });

  it("descarta porciones raras y fotos de otros sitios", () => {
    const n = parseOff(off({ serving_quantity: -3, image_front_url: "javascript:alert(1)", image_ingredients_url: "http://images.openfoodfacts.org/x.jpg", image_nutrition_url: "https://evil.example/x.jpg" }), "1");
    expect(n.servingQty).toBeNull();
    expect(n.updatedAt).toBeNull();
    expect(n.photos).toEqual({ front: null, nutrition: null, ingredients: null });
  });

  it("el pedido a la API trae los campos nuevos", () => {
    expect(offApiUrl("1")).toBe("https://world.openfoodfacts.org/api/v2/product/1?fields=product_name,nutriments,serving_size,serving_quantity,last_modified_t,image_front_url,image_nutrition_url,image_ingredients_url");
  });

  it("fixture real de Coca-Cola: trae fecha y foto del frente", () => {
    const n = parseOff(OFF["7790895000997"], "7790895000997");
    expect(n.updatedAt).toBeGreaterThan(0);
    expect(n.photos.front).toMatch(/^https:\/\/images\.openfoodfacts\.org\//);
  });
});
