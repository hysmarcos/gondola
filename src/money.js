// Pasa precios de Coto a número: "$2588.72", "$2.588,72", "$12.099", 3459.
export function parseMoney(text) {
  if (typeof text === "number") return Number.isFinite(text) ? text : null;
  if (typeof text !== "string") return null;
  let s = text.replace(/[^\d.,]/g, "");
  if (!/\d/.test(s)) return null;

  const hasDot = s.includes(".");
  const hasComma = s.includes(",");
  if (hasDot && hasComma) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (hasComma) {
    s = s.replace(",", ".");
  } else if (hasDot) {
    const decimals = s.length - s.lastIndexOf(".") - 1;
    if (decimals === 3) s = s.replace(/\./g, "");
  }

  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

// Pesos sin decimales, como los muestra Coto: 1899 → "$1.899".
const pesos = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });
export const formatMoney = (n) => "$" + pesos.format(n);
