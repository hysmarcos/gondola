// Logos de bancos y entidades de las promos de Coto. Los conocidos van empaquetados en
// assets/banks (recortados y achicados); uno nuevo se toma del sitio de Coto.

export const BUNDLED = new Set([
  "logo_amex1.png", "logo_ciudad1.png", "logo_columbia_1.png", "logo_comafi2.png", "logo_comafi_unico.png",
  "logo_comunidad.png", "logo_credicoop.png", "logo_galicia.png", "logo_icbc_1.png", "logo_macro_bma3.png",
  "logo_nacion_d.png", "logo_naranjax2.png", "logo_patagonia2.png", "logo_supervielle2.png", "logo_tci.png",
]);

const REMOTE = "https://static.cotodigital3.com.ar/sitios/cdigi/static/content/images/nuevositio/bancos/";
const SAFE = /^[\w.-]+\.(png|jpe?g|webp|svg)$/i;

// icono: el nombre que manda Coto ("logo_icbc_1.png"). getURL: chrome.runtime.getURL.
export function logoUrl(icono, getURL) {
  const name = String(icono ?? "");
  if (!SAFE.test(name) || name.includes("..")) return null;
  if (BUNDLED.has(name) && getURL) return getURL("assets/banks/" + name);
  return REMOTE + name;
}
