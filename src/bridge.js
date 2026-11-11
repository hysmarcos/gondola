// Puente entre chrome.storage (mundo aislado) y el intermediario de la página.
import { ALLERGENS } from "./nutrition.js";

const SOURCE = "coto-unit";
const KEYS = ["promos", "selectedPromoIds", "day", "autoPromo", "notifyPromo", "markBest", "comunidad", "compareStores", "nutrition",
  "profileCeliac", "profileSodium", "profileSugar", "profileAllergens"];

// Perfil personal: todo apagado salvo que el usuario lo prenda. Solo alergias conocidas.
export function profileOf(s) {
  const allergens = Array.isArray(s.profileAllergens) ? s.profileAllergens.filter((k) => k in ALLERGENS) : [];
  return { celiac: s.profileCeliac === true, sodium: s.profileSodium === true, sugar: s.profileSugar === true, allergens };
}

export function resolveDay(day) {
  return typeof day === "number" && day >= 0 && day <= 6 ? day : new Date().getDay();
}

// storage: { get(keys) → Promise<obj>, set(obj) → Promise, onChanged: { addListener(fn) } }
export function installBridge(win, storage, now = Date.now) {
  async function sendSettings() {
    try {
      const s = await storage.get(KEYS);
      const ids = new Set(s.selectedPromoIds ?? []);
      const selected = (s.promos ?? []).filter((p) => ids.has(p.id));
      win.postMessage({
        source: SOURCE, type: "settings", selected, day: resolveDay(s.day),
        // Ajustes del popup: encendidos salvo que el usuario los apague.
        autoPromo: s.autoPromo !== false, notifyPromo: s.notifyPromo !== false, markBest: s.markBest !== false, comunidad: s.comunidad !== false,
        compareStores: s.compareStores !== false, nutrition: s.nutrition !== false,
        profile: profileOf(s),
      }, "*");
    } catch { /* sin configuración: la página sigue sin banco */ }
  }

  win.addEventListener("message", (e) => {
    const m = e.data;
    if (m?.source !== SOURCE || m.type !== "promos" || !Array.isArray(m.promos) || !m.promos.length) return;
    storage.set({ promos: m.promos, fetchedAt: now() }).catch(() => {});
  });

  storage.onChanged.addListener((changes) => {
    if (KEYS.some((k) => k in changes)) sendSettings();
  });

  sendSettings();
}
