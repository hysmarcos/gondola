// Supermercados con los que se compara. El orden es el de la pantalla.
// Logos empaquetados (assets/stores): el ícono oficial de cada súper, bajado de su sitio.
// "coto" no es un súper con el que se compara, pero tiene su fila en el detalle.
const LOGOS = { coto: "coto.png", carrefour: "carrefour.svg", dia: "dia.png", mas: "mas.png" };

// id: el de STORES o "coto". getURL: chrome.runtime.getURL. null si no hay logo.
export function storeLogoUrl(id, getURL) {
  const file = Object.hasOwn(LOGOS, id) ? LOGOS[id] : null;
  return file && getURL ? getURL("assets/stores/" + file) : null;
}

export const STORE_LOGOS = Object.values(LOGOS);

export const STORES = [
  { id: "carrefour", name: "Carrefour", host: "www.carrefour.com.ar", sc: 1 },
  { id: "dia", name: "Día", host: "diaonline.supermercadosdia.com.ar", sc: 1 },
  { id: "mas", name: "Más", host: "www.masonline.com.ar", sc: 1 },
];
