// Puente entre chrome.storage (mundo aislado) y el intermediario de la página.
import { isComunidad } from "./banks.js";
import { enabledStores } from "./stores.js";
import { applies, cleanCards, migrateCards } from "./cards.js";
import { cardOf } from "./bank-rules/coto.js";

const SOURCE = "coto-unit";
const KEYS = ["promos", "selectedPromoIds", "cards", "day", "autoPromo", "notifyPromo", "markBest", "comunidad", "compareStores", "storesOff", "nutrition"];
// El perfil personal (información de salud) no pasa por acá: ver profile.js.

export function resolveDay(day) {
  return typeof day === "number" && day >= 0 && day <= 6 ? day : new Date().getDay();
}

// storage: { get(keys) → Promise<obj>, set(obj) → Promise, onChanged: { addListener(fn) } }
export function installBridge(win, storage, now = Date.now) {
  async function sendSettings() {
    try {
      const s = await storage.get(KEYS);
      // Una sola vez: las promos elegidas a mano pasan a ser tarjetas.
      const migrated = migrateCards(s, cardOf);
      if (migrated) storage.set({ cards: migrated }).catch(() => {});
      const cards = cleanCards(migrated ?? s.cards, s.promos);
      // Comunidad no se elige en Tarjetas: la prende el ajuste "Tengo Comunidad Coto".
      const comunidad = s.comunidad !== false;
      const selected = (s.promos ?? []).filter((p) => (isComunidad(p) ? comunidad : applies(cards, cardOf(p))));
      win.postMessage({
        source: SOURCE, type: "settings", selected, cards, day: resolveDay(s.day),
        // Ajustes del popup: encendidos salvo que el usuario los apague.
        autoPromo: s.autoPromo !== false, notifyPromo: s.notifyPromo !== false, markBest: s.markBest !== false, comunidad: s.comunidad !== false,
        compareStores: s.compareStores !== false, stores: enabledStores(s).map((st) => st.id), nutrition: s.nutrition !== false,
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
