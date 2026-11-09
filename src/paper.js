// Papel higiénico y rollos de cocina: el m² de Coto no compara bien entre doble y
// simple hoja. Leemos del nombre los metros (o paños) y la cantidad de rollos.

const TOILET = /papel\s+higi|p\.\s*higi/i;
const KITCHEN = /rollos?\s+(de\s+)?cocina/i;
const DOUBLE = /doble\s+hoja|\bd\/h\b/i;

const num = (s) => Number(String(s).replace(",", "."));

function rolls(name) {
  const m =
    name.match(/(\d+)\s*rollos?\b/i) ??
    name.match(/\bx\s*(\d+)\b(?!\s*(?:m|mts?|mtr|metros|pa[ñn]os)\b)/i) ??
    name.match(/(\d+)\s*(?:un|u|uni|unid|unidades?)\b/i) ??
    name.match(/paquete\s*(\d+)/i);
  return m ? num(m[1]) : null;
}

function metersPerRoll(name) {
  const m = name.match(/(\d+(?:[.,]\d+)?)\s*(?:m|mts?|mtr|metros)\b/i);
  return m ? num(m[1]) : null;
}

const round = (n) => Math.round(n * 100) / 100;

// → { group: "rollo10m" | "panos100" | null, divisor, note } o null si no es papel.
export function paperMetric(name) {
  const text = String(name ?? "");
  const toilet = TOILET.test(text);
  const kitchen = KITCHEN.test(text);
  if (!toilet && !kitchen) return null;
  const note = DOUBLE.test(text) ? "doble hoja" : null;

  if (kitchen) {
    const panos = text.match(/(\d+)\s*pa[ñn]os/i);
    if (panos) return { group: "panos100", divisor: round((num(panos[1]) * (rolls(text) ?? 1)) / 100), note };
  }
  if (toilet) {
    const meters = metersPerRoll(text);
    const n = rolls(text);
    if (meters && n) return { group: "rollo10m", divisor: round((meters * n) / 10), note };
  }
  return { group: null, divisor: null, note };
}
