// Ventana de la extensión: pestañas Tarjetas, Ajustes, Colaborá y Ayuda.
// Para sumar un menú: una entrada en TABS y su función en VIEWS.
import { ALLERGENS } from "./nutrition.js";
import { feedbackLinks, REPO } from "./feedback.js";
import { STORES } from "./stores.js";
import { el, icon, plural, switchInput } from "./popup-dom.js";
import { cardsView } from "./popup-cards.js";

const TABS = [
  { id: "tarjetas", label: "Tarjetas", icon: ["M3 8a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3z", "M3 10h18", "M7 15h4"] },
  { id: "ajustes", label: "Ajustes", icon: ["M4 6h8", "M16 6h4", "M4 12h2", "M10 12h10", "M4 18h11", "M19 18h1", "M14 4v4", "M8 10v4", "M17 16v4"] },
  { id: "colabora", label: "Colaborá", icon: ["M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z", "M12 7v6", "M9 10h6"] },
  { id: "ayuda", label: "Ayuda", icon: ["M12 21a9 9 0 1 0 0-18a9 9 0 0 0 0 18z", "M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.6v.6", "M12 17.2v.1"] },
];

// Ajustes por secciones: cada una es una fila del menú y abre su propia pantalla.
// Para sumar un ajuste: una entrada en SETTINGS con la sección donde va.
const SECTIONS = [
  { id: "apariencia", title: "Apariencia", text: "Cómo se ve Coto", icon: ["M4 5h16v14H4z", "M4 10h16", "M10 10v9"] },
  { id: "precios", title: "Precios y promos", text: "Comunidad, 2x1 y avisos", icon: ["M4 4h7l9 9l-7 7l-9-9z", "M8.5 8.5v.1"] },
  { id: "datos", title: "Comparar y nutrición", text: "Datos de afuera de Coto", icon: ["M4 9l1.5-5h13L20 9", "M4 9v11h16V9", "M4 9a3 3 0 0 0 5.3 0a3 3 0 0 0 5.4 0A3 3 0 0 0 20 9", "M10 20v-5h4v5"] },
  { id: "perfil", title: "Mi perfil", text: "Celiaquía y alergias", icon: ["M12 12a4 4 0 1 0 0-8a4 4 0 0 0 0 8z", "M4 21a8 8 0 0 1 16 0"] },
];

const SETTINGS = [
  { key: "skin", section: "apariencia", title: "Diseño Góndola", text: "Diseño nuevo en la lista de productos y en la página de producto. Apagalo para ver el de Coto." },
  { key: "comunidad", section: "precios", title: "Tengo Comunidad Coto", text: "Usa el precio Comunidad (+5%, +15%…) y el descuento Comunidad del día (por ejemplo, 20% los miércoles)." },
  { key: "autoPromo", section: "precios", title: "Completar promos 2x1, 3x2", text: "En un 2x1, al agregar 1 suma el gratis. En un 3x2, al llegar a 2 suma el tercero." },
  { key: "notifyPromo", section: "precios", title: "Avisar promos por cantidad", text: "Un aviso corto cuando el producto tiene promo por llevar más." },
  { key: "markBest", section: "apariencia", title: "Marcar el más barato", text: "Cartel \"Más barato de la categoría\" en el producto que más conviene por kg, litro o unidad." },
  { key: "compareStores", section: "datos", title: "Comparar con otros súper", text: "Un botón dice si Coto tiene el mejor precio o en qué súper está más barato." },
  { key: "nutrition", section: "datos", title: "Información nutricional", text: "La tabla nutricional de Open Food Facts en el producto, el resumen del carrito y las etiquetas de alergias en la lista." },
];

const HELP = [
  ["Precio real para comparar", "El precio por kg, litro, unidad o 10 m de papel, ya con la oferta de Coto."],
  ["Hoy con tu banco", "El mismo precio con la promo de tu tarjeta, si Coto la aplica a ese producto."],
  ["Banco no aplica", "El producto ya está en oferta o Coto lo excluye de las promos bancarias."],
  ["Ordenar por precio por kg/L", "Nueva opción en \"Ordenar por\" de cada categoría y búsqueda."],
  ["Información nutricional", "Tabla de Open Food Facts por código de barras, cargada por la comunidad. Si falta, podés cargarla vos."],
  ["Sin TACC", "Lo que marca Coto. Si el producto menciona trigo, avena, cebada o centeno, te avisa. Verificá siempre el símbolo oficial en el envase."],
  ["Mi perfil", "En Ajustes, sección Mi perfil. Destaca lo que te importa en cada producto. En la lista, con \"Diseño Góndola\" e \"Información nutricional\" prendidos, marca los productos que declaran tus alergias y avisa si Open Food Facts no tiene datos de alérgenos. Sin etiqueta no significa que sea seguro. Queda solo en tu navegador. No es consejo médico."],
  ["Otros súper", "Precio del mismo producto (mismo código de barras) en la web de Carrefour, Día y Más, zona por defecto. Puede variar en tu sucursal. Elegís con cuáles comparar en Ajustes. \"llevando 2\": precio por unidad con su promo."],
  ["Promos de otros súper", "Las promos de otros súper son solo de compra online. Los totales no incluyen envío. Si los términos de una promo cambiaron, no se resta."],
  ["Carrito comparado", "En el carrito, compara solo los productos que están en los dos súper. Si faltan, \"Faltan N\" muestra cuáles."],
  ["Tarjetas para todos los súper", "Tus tarjetas valen para Coto y para los otros súper. De Carrefour todavía no se pueden leer las promos del banco: se compara solo por precio."],
];

const PROFILE = [
  { key: "profileCeliac", title: "Soy celíaco/a", text: "Muestra si Coto o Open Food Facts lo marcan Sin TACC." },
  { key: "profileSodium", title: "Cuido el sodio", text: "Destaca el sodio cada 100 g o 100 ml." },
  { key: "profileSugar", title: "Cuido el azúcar", text: "Destaca los azúcares cada 100 g o 100 ml." },
];

function settingRow(doc, { key, title, text }, checked, storage, onChange = () => {}) {
  const box = switchInput(doc, { name: key, checked });
  box.addEventListener("change", () => {
    storage.set({ [key]: box.checked });
    onChange();
  });
  return el(doc, "label", { className: "setting" }, [
    el(doc, "span", { className: "setting-text" }, [el(doc, "span", { className: "setting-title", textContent: title }), el(doc, "span", { className: "setting-desc", textContent: text })]),
    box,
  ]);
}

// Un interruptor por súper, debajo de "Comparar con otros súper". Apagar uno escribe storesOff.
// Si el súper no respondió la última vez, la fila lo dice.
function storeRows(doc, s, storage) {
  const off = new Set(Array.isArray(s.storesOff) ? s.storesOff : []);
  return STORES.map((st) => {
    const box = switchInput(doc, { name: `store-${st.id}`, checked: !off.has(st.id), disabled: s.compareStores === false });
    box.addEventListener("change", () => {
      if (box.checked) off.delete(st.id);
      else off.add(st.id);
      storage.set({ storesOff: STORES.map((x) => x.id).filter((id) => off.has(id)) });
    });
    const failed = s.storeStatus?.[st.id] === "error";
    const row = el(doc, "label", { className: "row row--sub" }, [
      el(doc, "span", { className: "row-text", textContent: st.name }),
      failed ? el(doc, "span", { className: "row-note", textContent: "No responde" }) : null,
      box,
    ]);
    row.dataset.store = st.id;
    return row;
  });
}

// Mi perfil: apagado por defecto. Queda en el navegador.
function profileView(doc, s, storage, onChange = () => {}) {
  const chosen = new Set(Array.isArray(s.profileAllergens) ? s.profileAllergens : []);
  const boxes = Object.entries(ALLERGENS).map(([key, name]) => {
    const box = el(doc, "input", { type: "checkbox", name: "profileAllergens", value: key, checked: chosen.has(key) });
    box.addEventListener("change", () => {
      if (box.checked) chosen.add(key);
      else chosen.delete(key);
      storage.set({ profileAllergens: Object.keys(ALLERGENS).filter((k) => chosen.has(k)) });
      onChange();
    });
    return el(doc, "label", { className: "profile-allergen" }, [box, ` ${name}`]);
  });
  return [
    el(doc, "p", { className: "profile-desc", textContent: "Destaca lo que te importa en la página de cada producto. Queda solo en tu navegador. No es consejo médico." }),
    ...PROFILE.map((item) => settingRow(doc, item, s[item.key] === true, storage, onChange)),
    el(doc, "fieldset", { className: "profile-allergens" }, [el(doc, "legend", { textContent: "Mis alergias" }), ...boxes]),
  ];
}

// Ajustes: un menú de secciones. Cada fila abre su pantalla y "Ajustes" vuelve al menú.
function settingsView(doc, s, storage, meta = {}) {
  const menu = el(doc, "ul", { className: "menu" });
  const screens = {};
  const rows = {};
  const show = (id, focus = true) => {
    menu.hidden = !!id;
    for (const [k, sc] of Object.entries(screens)) sc.hidden = k !== id;
    if (!focus) return;
    if (id) screens[id].querySelector(".back").focus();
    else (rows[show.last] ?? menu.querySelector("button")).focus();
  };
  for (const sec of SECTIONS) {
    const status = el(doc, "span", { className: "menu-status" });
    const body = el(doc, "div", { className: "screen-body" });
    // El estado de la fila: cuántos ajustes están prendidos, o qué hay en el perfil.
    const update = () => {
      const boxes = [...body.querySelectorAll(".setting input.switch")];
      const on = boxes.filter((b) => b.checked).length;
      if (sec.id !== "perfil") status.replaceChildren(`${on} de ${boxes.length}`, el(doc, "span", { className: "sr-only", textContent: " prendidos" }));
      else {
        const allergies = body.querySelectorAll('input[name="profileAllergens"]:checked').length;
        status.textContent = on + allergies ? [on && plural(on, "cuidado", "cuidados"), allergies && plural(allergies, "alergia", "alergias")].filter(Boolean).join(" · ") : "Sin cargar";
      }
    };
    if (sec.id === "perfil") body.append(...profileView(doc, s, storage, update));
    else {
      for (const item of SETTINGS.filter((x) => x.section === sec.id)) {
        const onChange = item.key === "compareStores" ? () => { update(); for (const b of body.querySelectorAll("[data-store] input")) b.disabled = !body.querySelector('input[name="compareStores"]').checked; } : update;
        body.append(settingRow(doc, item, s[item.key] !== false, storage, onChange));
        if (item.key === "compareStores") body.append(...storeRows(doc, s, storage));
      }
    }
    update();

    const row = el(doc, "button", { type: "button", className: "menu-row" }, [
      el(doc, "span", { className: "menu-icon" }, [icon(doc, sec.icon)]),
      el(doc, "span", { className: "menu-text" }, [el(doc, "span", { className: "menu-title", textContent: sec.title }), el(doc, "span", { className: "menu-desc", textContent: sec.text })]),
      status,
      icon(doc, ["M9 6l6 6l-6 6"]),
    ]);
    row.dataset.section = sec.id;
    row.addEventListener("click", () => { show.last = sec.id; show(sec.id); });
    rows[sec.id] = row;
    menu.append(el(doc, "li", {}, [row]));

    const back = el(doc, "button", { type: "button", className: "back" }, [icon(doc, ["M15 6l-6 6l6 6"]), el(doc, "span", { textContent: "Ajustes" })]);
    back.addEventListener("click", () => show(null));
    const screen = el(doc, "div", { className: "screen", hidden: true }, [
      back,
      el(doc, "h2", { className: "screen-title" }, [el(doc, "span", { className: "menu-icon" }, [icon(doc, sec.icon)]), el(doc, "span", { textContent: sec.title })]),
      body,
    ]);
    screen.dataset.section = sec.id;
    screens[sec.id] = screen;
  }
  if (SECTIONS.some((x) => x.id === meta.section)) show(meta.section, false);
  return [menu, ...Object.values(screens)];
}

function helpView(doc, meta) {
  return [
    el(doc, "dl", { className: "help" }, HELP.flatMap(([t, d]) => [el(doc, "dt", { textContent: t }), el(doc, "dd", { textContent: d })])),
    el(doc, "p", { className: "legal" }, [
      el(doc, "strong", { textContent: "No afiliado a Coto." }),
      " Usa los datos de coto.com.ar. A Carrefour, Día y Más les envía códigos de barras y cantidades del carrito para comparar. A Open Food Facts, solo códigos de barras. Sin cookies ni datos personales.",
    ]),
    meta.welcomeUrl ? el(doc, "p", { className: "welcome-link" }, [el(doc, "a", { href: meta.welcomeUrl, target: "_blank", rel: "noopener noreferrer", textContent: "Ver la bienvenida de nuevo" })]) : null,
    el(doc, "p", { className: "version", textContent: `Versión ${meta.version ?? ""}`.trim() }),
  ];
}

// Colaborá: cada link abre un formulario de GitHub en otra pestaña.
function contribView(doc, meta) {
  const link = (it) => {
    const a = el(doc, "a", { className: "contrib-link", href: it.href, target: "_blank", rel: "noopener noreferrer" }, [
      el(doc, "span", { className: "contrib-icon" }, [icon(doc, it.icon)]),
      el(doc, "span", { className: "contrib-text" }, [el(doc, "span", { className: "contrib-title", textContent: it.title }), el(doc, "span", { className: "contrib-desc", textContent: it.text })]),
      icon(doc, ["M9 6l6 6l-6 6"]),
    ]);
    a.dataset.contrib = it.id;
    return el(doc, "li", {}, [a]);
  };
  return [
    el(doc, "p", { className: "contrib-lead" }, [
      el(doc, "strong", { textContent: "Góndola la mejoramos entre todos." }),
      " Contanos qué falla o qué te gustaría. Las ideas con más 👍 van primero.",
    ]),
    el(doc, "ul", { className: "contrib" }, feedbackLinks(meta.version).map(link)),
    el(doc, "p", { className: "contrib-note" }, [
      "Se abre GitHub. Necesitás una cuenta gratis. El código es abierto: ",
      el(doc, "a", { href: REPO, target: "_blank", rel: "noopener noreferrer", textContent: "github.com/hysmarcos/gondola" }),
      ".",
    ]),
  ];
}

const VIEWS = { tarjetas: (doc, s, st, meta) => cardsView(doc, s, st, meta), ajustes: settingsView, colabora: (doc, s, st, meta) => contribView(doc, meta), ayuda: (doc, s, st, meta) => helpView(doc, meta) };

// storage: misma interfaz que en bridge.js.
// meta: { version, logoUrl, welcomeUrl, tab, section, stores, storePromos }. tab y section abren
// el popup en ese lugar. stores y storePromos son las promos de los otros súper (ver popup-cards.js).
const KEYS = ["skin", "promos", "selectedPromoIds", "cards", "day", "autoPromo", "notifyPromo", "markBest", "comunidad", "compareStores", "storesOff", "storeStatus", "nutrition", "profileCeliac", "profileSodium", "profileSugar", "profileAllergens", "popupTab"];

// Devuelve { refreshCards() }: vuelve a dibujar solo la pestaña Tarjetas (cuando llegan las
// promos), sin tocar las otras pestañas y con la búsqueda que estaba escrita.
export async function renderPopup(doc, storage, meta = {}) {
  const s = await storage.get(KEYS);
  const wanted = meta.section ? "ajustes" : meta.tab ?? s.popupTab;
  let active = TABS.some((t) => t.id === wanted) ? wanted : "tarjetas";

  const header = el(doc, "header", { className: "top" }, [
    el(doc, "img", { className: "mark", src: "assets/icon/icon.svg", alt: "", attrs: { width: "34", height: "34" } }),
    el(doc, "div", {}, [el(doc, "h1", { textContent: "Góndola" }), el(doc, "p", { className: "sub", textContent: "para Coto Digital" })]),
  ]);

  const panels = {};
  const tabs = {};
  const main = el(doc, "main");
  const nav = el(doc, "nav", { className: "tabs", attrs: { role: "tablist", "aria-label": "Menú" } });

  const select = (id, focus = false) => {
    active = id;
    for (const t of TABS) {
      const on = t.id === id;
      tabs[t.id].setAttribute("aria-selected", String(on));
      tabs[t.id].tabIndex = on ? 0 : -1;
      panels[t.id].hidden = !on;
    }
    if (focus) tabs[id].focus();
  };

  TABS.forEach((t, i) => {
    const panel = el(doc, "section", { className: "panel", attrs: { role: "tabpanel", id: `panel-${t.id}`, "aria-labelledby": `tab-${t.id}` } }, VIEWS[t.id](doc, s, storage, meta));
    panel.dataset.view = t.id;
    panels[t.id] = panel;
    main.append(panel);
    const tab = el(doc, "button", { type: "button", className: "tab", attrs: { role: "tab", id: `tab-${t.id}`, "aria-controls": `panel-${t.id}` } }, [icon(doc, t.icon), el(doc, "span", { textContent: t.label })]);
    tab.addEventListener("click", () => {
      select(t.id);
      storage.set({ popupTab: t.id });
    });
    tab.addEventListener("keydown", (e) => {
      const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
      if (!step) return;
      const next = TABS[(i + step + TABS.length) % TABS.length].id;
      select(next, true);
      storage.set({ popupTab: next });
    });
    tabs[t.id] = tab;
    nav.append(tab);
  });
  select(active);

  doc.body.replaceChildren(header, main, nav);

  async function refreshCards() {
    const panel = panels.tarjetas;
    const q = panel.querySelector('input[type="search"]')?.value ?? "";
    panel.replaceChildren(...VIEWS.tarjetas(doc, await storage.get(KEYS), storage, meta));
    const search = panel.querySelector('input[type="search"]');
    if (search && q) {
      search.value = q;
      search.dispatchEvent(new Event("input", { bubbles: true }));
    }
  }
  return { refreshCards };
}
