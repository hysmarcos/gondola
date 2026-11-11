// Perfil personal del popup (celíaco/a, sodio, azúcar, alergias). Es información de salud:
// se lee directo de chrome.storage en el content script aislado y nunca se manda por
// window.postMessage, que los scripts de la página de Coto pueden leer.
import { ALLERGENS } from "./nutrition.js";

export const PROFILE_KEYS = ["profileCeliac", "profileSodium", "profileSugar", "profileAllergens"];

// Todo apagado salvo que el usuario lo prenda. Solo alergias conocidas.
export function profileOf(s) {
  const allergens = Array.isArray(s?.profileAllergens) ? s.profileAllergens.filter((k) => k in ALLERGENS) : [];
  return { celiac: s?.profileCeliac === true, sodium: s?.profileSodium === true, sugar: s?.profileSugar === true, allergens };
}

// storage: { get(keys), onChanged: { addListener(fn) } }. onProfile(perfil) al arrancar y
// cada vez que cambia una clave del perfil.
export function installProfile(storage, onProfile) {
  const send = () => storage.get(PROFILE_KEYS).then((s) => onProfile(profileOf(s))).catch(() => {});
  storage.onChanged.addListener((changes) => {
    if (PROFILE_KEYS.some((k) => k in changes)) send();
  });
  send();
}
