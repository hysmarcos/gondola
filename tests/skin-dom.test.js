import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import { DOM, REQUIRED } from "../src/skin-dom.js";

const load = (f) => new JSDOM(readFileSync(`tests/fixtures/dom/${f}.html`, "utf8")).window.document;

// El selector de cantidad solo aparece con sesión iniciada y las capturas se hacen sin
// sesión. Hasta tener una captura con sesión (WAIT_STEPPER=<segundos> npm run fixtures:dom),
// su selector sale del código que ya lo usa y no se comprueba contra el HTML.
const SIN_CAPTURA = { list: ["stepper"], pdp: ["stepper"] };

describe.each(["list", "pdp"])("mapa de selectores: %s", (page) => {
  const doc = load(page === "list" ? "lista" : "pdp");
  it("cada selector no nulo encuentra al menos un nodo", () => {
    for (const [key, sel] of Object.entries(DOM[page])) {
      if (sel && !SIN_CAPTURA[page].includes(key)) expect(doc.querySelector(sel), `${page}.${key} = ${sel}`).not.toBeNull();
    }
  });
  it("las claves obligatorias existen y no son nulas", () => {
    for (const key of REQUIRED[page]) expect(DOM[page][key], key).toBeTruthy();
  });
});

it("en la lista, la grilla guarda las tarjetas y cada tarjeta trae sus partes", () => {
  const doc = load("lista");
  const cards = doc.querySelectorAll(`${DOM.list.grid} ${DOM.list.card}`);
  expect(cards.length).toBe(8);
  for (const card of cards) {
    for (const key of ["centro", "buttons", "name", "addButton"]) {
      expect(card.querySelector(DOM.list[key]), key).not.toBeNull();
    }
  }
});

it("en la lista, el botón está dentro de la tarjeta", () => {
  const doc = load("lista");
  expect(doc.querySelector(`${DOM.list.card} ${DOM.list.addButton}`)).not.toBeNull();
});

it.todo("en la lista, el selector de cantidad está dentro de la tarjeta (falta una captura con sesión)");

it("en la PDP, el precio y el botón están en la columna de compra, y la galería no", () => {
  const doc = load("pdp");
  const buy = doc.querySelector(DOM.pdp.buy);
  for (const key of ["price", "addButton", "title", "cuotas"]) {
    expect(buy.contains(doc.querySelector(DOM.pdp[key])), key).toBe(true);
  }
  expect(buy.contains(doc.querySelector(DOM.pdp.big))).toBe(false);
});
