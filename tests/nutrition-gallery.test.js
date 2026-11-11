// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { photoList, paintGallery } from "../src/nutrition-gallery.js";

const BASE = "https://images.openfoodfacts.org/images/products/779/074/235/8608";
const PHOTOS = {
  front: `${BASE}/front_es.134.400.jpg`,
  nutrition: `${BASE}/nutrition_en.61.400.jpg`,
  ingredients: `${BASE}/ingredients_es.135.400.jpg`,
};
const N = { per100: { kcal: 42 }, photos: PHOTOS, url: "https://world.openfoodfacts.org/product/7790742358608" };
const ICON = "chrome-extension://x/assets/off/off-logo-icon-light.svg";
const EAN = "7790742358608";

describe("photoList", () => {
  it("frente, tabla e ingredientes, con la foto grande .full.jpg", () => {
    expect(photoList(PHOTOS)).toEqual([
      { kind: "front", label: "frente", thumb: PHOTOS.front, full: `${BASE}/front_es.134.full.jpg` },
      { kind: "nutrition", label: "tabla nutricional", thumb: PHOTOS.nutrition, full: `${BASE}/nutrition_en.61.full.jpg` },
      { kind: "ingredients", label: "ingredientes", thumb: PHOTOS.ingredients, full: `${BASE}/ingredients_es.135.full.jpg` },
    ]);
  });

  it("solo las que existen; sin tamaño 400 usa la misma URL", () => {
    expect(photoList({ front: null, nutrition: `${BASE}/n.jpg`, ingredients: null })).toEqual([
      { kind: "nutrition", label: "tabla nutricional", thumb: `${BASE}/n.jpg`, full: `${BASE}/n.jpg` },
    ]);
    expect(photoList(undefined)).toEqual([]);
  });
});

describe("paintGallery", () => {
  let gallery, cotoThumb;

  beforeEach(() => {
    document.body.innerHTML = `<article class="gallery-wrap">
      <div class="img-big-wrap position-relative"><img class="image" src="https://static.cotodigital3.com.ar/large.jpg"></div>
      <div class="thumbnail-wrapper"><div class="thumbs-wrap columna-img">
        <div class="item-thumb cursor-pointer"><img width="60" height="60" src="https://static.cotodigital3.com.ar/mini.jpg"></div>
      </div></div></article>`;
    gallery = { thumbs: document.querySelector(".thumbs-wrap"), big: document.querySelector(".img-big-wrap") };
    cotoThumb = document.querySelector(".item-thumb");
  });

  const ours = () => [...gallery.thumbs.querySelectorAll(".coto-unit-offthumb")];
  const view = () => gallery.big.querySelector(".coto-unit-offview");

  it("agrega una miniatura por foto, después de las de Coto, con el ícono de OFF", () => {
    paintGallery(document, gallery, EAN, N, ICON);
    const t = ours();
    expect(t).toHaveLength(3);
    expect(gallery.thumbs.firstElementChild).toBe(cotoThumb);
    expect(t[0].classList.contains("item-thumb")).toBe(true);
    expect(t[0].dataset.ean).toBe(EAN);
    const img = t[0].querySelector("img.coto-unit-offthumb-photo");
    expect(img.getAttribute("src")).toBe(PHOTOS.front);
    expect(img.alt).toBe("Foto de Open Food Facts: frente");
    expect(t[1].querySelector("img.coto-unit-offthumb-photo").alt).toBe("Foto de Open Food Facts: tabla nutricional");
    expect(t[0].querySelector("img.coto-unit-offthumb-badge").getAttribute("src")).toBe(ICON);
  });

  it("clic en una miniatura: visor con la foto grande y el aviso de que no es de Coto", () => {
    paintGallery(document, gallery, EAN, N, ICON);
    ours()[1].click();
    const v = view();
    expect(v.querySelector("img.coto-unit-offview-photo").getAttribute("src")).toBe(`${BASE}/nutrition_en.61.full.jpg`);
    expect(v.querySelector("img.coto-unit-offview-photo").alt).toBe("Foto de Open Food Facts: tabla nutricional");
    expect(v.textContent).toContain("Foto de Open Food Facts, cargada por la comunidad. No es una foto de Coto.");
    const a = v.querySelector("a");
    expect(a.textContent).toBe("Ver en Open Food Facts");
    expect(a.href).toBe(N.url);
    expect(a.target).toBe("_blank");
    expect(a.rel).toBe("noopener noreferrer");
    expect(ours()[1].classList.contains("coto-unit-offthumb--active")).toBe(true);
    ours()[0].click();
    expect(gallery.big.querySelectorAll(".coto-unit-offview")).toHaveLength(1);
    expect(view().querySelector("img").getAttribute("src")).toBe(`${BASE}/front_es.134.full.jpg`);
    expect(ours()[1].classList.contains("coto-unit-offthumb--active")).toBe(false);
  });

  it("clic en una miniatura de Coto cierra el visor", () => {
    paintGallery(document, gallery, EAN, N, ICON);
    ours()[0].click();
    cotoThumb.querySelector("img").click();
    expect(view()).toBeNull();
    expect(ours().some((t) => t.classList.contains("coto-unit-offthumb--active"))).toBe(false);
  });

  it("repintar el mismo producto no duplica ni cierra el visor", () => {
    paintGallery(document, gallery, EAN, N, ICON);
    ours()[2].click();
    paintGallery(document, gallery, EAN, N, ICON);
    expect(ours()).toHaveLength(3);
    expect(view()).not.toBeNull();
  });

  it("sin datos, otro producto o sin galería: borra miniaturas y visor", () => {
    paintGallery(document, gallery, EAN, N, ICON);
    ours()[0].click();
    paintGallery(document, gallery, null, null, ICON);
    expect(ours()).toHaveLength(0);
    expect(view()).toBeNull();
    paintGallery(document, gallery, EAN, "missing", ICON);
    expect(ours()).toHaveLength(0);
    paintGallery(document, gallery, EAN, N, ICON);
    paintGallery(document, gallery, "999", { ...N, photos: { front: PHOTOS.front } }, ICON);
    expect(ours().map((t) => t.dataset.ean)).toEqual(["999"]);
    expect(() => paintGallery(document, null, EAN, N, ICON)).not.toThrow();
  });

  it("sin fotos no agrega nada", () => {
    paintGallery(document, gallery, EAN, { ...N, photos: { front: null, nutrition: null, ingredients: null } }, ICON);
    expect(ours()).toHaveLength(0);
  });
});
