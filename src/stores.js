// Supermercados con los que se compara. El orden es el de la pantalla.
export const STORES = [
  { id: "carrefour", name: "Carrefour", host: "www.carrefour.com.ar", sc: 1, promosUrl: "https://www.carrefour.com.ar/descuentos-bancarios" },
  { id: "dia", name: "Día", host: "diaonline.supermercadosdia.com.ar", sc: 1, promosUrl: "https://diaonline.supermercadosdia.com.ar/medios-de-pago-y-promociones" },
  { id: "mas", name: "Más", host: "www.masonline.com.ar", sc: 1, promosUrl: "https://www.masonline.com.ar/promociones-bancarias" },
];

// Los súper de una lista de ids (la que viaja en el mensaje "settings"), en el orden de la pantalla.
export const storesFrom = (ids) => STORES.filter((st) => Array.isArray(ids) && ids.includes(st.id));

// Los súper que el usuario deja prendidos. `s` es lo guardado en chrome.storage.
// Con "Comparar con otros súper" apagado no queda ninguno.
export function enabledStores(s = {}) {
  if (s.compareStores === false) return [];
  const off = Array.isArray(s.storesOff) ? s.storesOff : [];
  return STORES.filter((st) => !off.includes(st.id));
}
