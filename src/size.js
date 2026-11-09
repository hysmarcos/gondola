// Tamaño que dice el nombre del producto ("500g", "1,5 L", "6 x 500 ml", "1 Kgm", ".5 Grm").

const UNITS = [
  [/^(kgm|kgs?|kilos?)$/, "kg", 1],
  [/^(g|gr|grs|grm|gramos)$/, "kg", 0.001],
  [/^(l|lt|lts|ltr|litro|litros)$/, "L", 1],
  [/^(ml|cc|cm3)$/, "L", 0.001],
];
// Un número pegado a letras ("Spk7378g") no es un tamaño; la "x" de los packs sí vale.
const NUM = "(?<![a-wyz\\d.,])(\\d*[.,]?\\d+)";
const MAX_PACK = 48;
const UNIT = "(kgm|kgs?|kilos?|grm|grs?|gramos|g|lts?|ltr|litros?|l|ml|cc|cm3)\\b";
const SIZE = `${NUM}\\s*${UNIT}`;

const round = (n) => Math.round(n * 1e6) / 1e6;

// Correcciones de cómo escribe Coto: ".5 Grm" es medio kilo y "1,75 Ml" son litros.
function toAmount(n, unit) {
  const u = unit.toLowerCase();
  const value = Number(n.replace(",", "."));
  const decimal = /[.,]/.test(n);
  for (const [re, kind, mult] of UNITS) {
    if (!re.test(u)) continue;
    if (kind === "kg" && mult < 1 && /^[.,]/.test(n)) return { kind, amount: value };
    if (kind === "L" && mult < 1 && decimal && value < 10) return { kind, amount: value };
    // "1250 Kgm": más de 100 kg o 100 L en un producto de góndola son gramos o ml.
    if (mult === 1 && value >= 100) return { kind, amount: value / 1000 };
    return { kind, amount: value * mult };
  }
  return null;
}

// → { kind: "kg" | "L", amounts: [unidad, total del pack?], multi } o null.
// multi: el nombre trae dos tamaños distintos y no se sabe cuál vale.
export function sizeFromName(name) {
  const text = String(name ?? "");
  const pack = text.match(new RegExp(`(\\d+)\\s*x\\s*${SIZE}`, "i"));
  // "500X350 Ml": un pack de 500 no es creíble; el nombre queda ambiguo.
  if (pack && Number(pack[1]) > MAX_PACK) {
    const one = toAmount(pack[2], pack[3]);
    if (one) return { kind: one.kind, amounts: [round(one.amount)], multi: true };
  }
  if (pack) {
    const one = toAmount(pack[2], pack[3]);
    if (one) return { kind: one.kind, amounts: [round(one.amount), round(one.amount * Number(pack[1]))], multi: false };
  }
  const all = [...text.matchAll(new RegExp(SIZE, "gi"))].map((m) => toAmount(m[1], m[2])).filter(Boolean);
  const one = all.at(-1);
  if (!one) return null;
  const multi = new Set(all.map((a) => a.kind + round(a.amount))).size > 1;
  // Packs con la cantidad aparte: "473 CC 6 Unidades", "4 Uni X 80 Gr", "Pack X 4", "90 G 3 U".
  const count = packCount(text);
  const amounts = count ? [round(one.amount), round(one.amount * count)] : [round(one.amount)];
  return { kind: one.kind, amounts, multi };
}

function packCount(text) {
  const m =
    text.match(/(?<![\d.,])(\d+)\s*(?:u|un|uni|unid|unidades?)\b/i) ??
    text.match(/\b(?:pack|display)\s*x\s*(\d+)\b/i);
  const n = m ? Number(m[1]) : 0;
  return n >= 2 && n <= MAX_PACK ? n : null;
}

// "Filete De Merluza X Kg": se vende por kilo.
export function soldPerKg(name) {
  return /\bx\s*kg\b/i.test(String(name ?? ""));
}
