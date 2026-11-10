// Ventana de la extensión: pestañas Tarjetas, Ajustes, Colaborá y Ayuda.
// Para sumar un menú: una entrada en TABS y su función en VIEWS.
import { dayName } from "./banks.js";
import { feedbackLinks, REPO } from "./feedback.js";

const money = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });
const SVG = "http://www.w3.org/2000/svg";

const TABS = [
  { id: "tarjetas", label: "Tarjetas", icon: ["M3 8a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3z", "M3 10h18", "M7 15h4"] },
  { id: "ajustes", label: "Ajustes", icon: ["M4 6h8", "M16 6h4", "M4 12h2", "M10 12h10", "M4 18h11", "M19 18h1", "M14 4v4", "M8 10v4", "M17 16v4"] },
  { id: "colabora", label: "Colaborá", icon: ["M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z", "M12 7v6", "M9 10h6"] },
  { id: "ayuda", label: "Ayuda", icon: ["M12 21a9 9 0 1 0 0-18a9 9 0 0 0 0 18z", "M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.6v.6", "M12 17.2v.1"] },
];

const SETTINGS = [
  { key: "comunidad", title: "Tengo Comunidad Coto", text: "Usa el precio Comunidad (+5%, +15%…) cuando el producto lo tiene." },
  { key: "autoPromo", title: "Completar promos 2x1, 3x2", text: "En un 2x1, al agregar 1 suma el gratis. En un 3x2, al llegar a 2 suma el tercero." },
  { key: "notifyPromo", title: "Avisar promos por cantidad", text: "Un aviso corto cuando el producto tiene promo por llevar más." },
  { key: "markBest", title: "Marcar el más barato", text: "Cartel \"Más barato de la categoría\" en el producto que más conviene por kg, litro o unidad." },
  { key: "compareStores", title: "Comparar con otros súper", text: "Un botón dice si Coto tiene el mejor precio o en qué súper está más barato." },
  { key: "nutrition", title: "Información nutricional", text: "En la página de un producto, la tabla nutricional de Open Food Facts, si existe." },
];

const HELP = [
  ["Precio real para comparar", "El precio por kg, litro, unidad o 10 m de papel, ya con la oferta de Coto."],
  ["Hoy con tu banco", "El mismo precio con la promo de tu tarjeta, si Coto la aplica a ese producto."],
  ["Banco no aplica", "El producto ya está en oferta o Coto lo excluye de las promos bancarias."],
  ["Ordenar por precio por kg/L", "Nueva opción en \"Ordenar por\" de cada categoría y búsqueda."],
  ["Otros súper", "Precio del mismo producto (mismo código de barras) en la web de Carrefour, Día y Más, zona por defecto. Puede variar en tu sucursal. Sin descuentos bancarios. \"llevando 2\": precio por unidad con su promo."],
];

function describe(p) {
  const days = p.days.map(dayName).join(", ");
  const cap = p.cap ? `tope $${money.format(p.cap)}${p.capWeekly ? " por semana" : ""}` : "sin tope";
  const only = p.onlyNoOffer ? " · solo sin oferta" : "";
  return `${days} · ${p.percent}% · ${cap}${only}`;
}

function el(doc, tag, props = {}, children = []) {
  const e = doc.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === "attrs") for (const [a, val] of Object.entries(v)) e.setAttribute(a, val);
    else e[k] = v;
  }
  for (const c of children) if (c != null) e.append(c);
  return e;
}

function icon(doc, paths) {
  const svg = doc.createElementNS(SVG, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("class", "icon");
  for (const d of paths) {
    const p = doc.createElementNS(SVG, "path");
    p.setAttribute("d", d);
    svg.append(p);
  }
  return svg;
}

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const norm = (t) => String(t).normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

function switchInput(doc, props) {
  return el(doc, "input", { type: "checkbox", className: "switch", ...props, attrs: { role: "switch", ...(props.attrs ?? {}) } });
}

// Logo del banco (decorativo: el nombre va al lado). Si no carga, deja el lugar vacío.
function bankLogo(doc, items, logoUrl) {
  const src = logoUrl(items.find((p) => p.logo)?.logo);
  if (!src) return el(doc, "span", { className: "bank-logo bank-logo--empty", attrs: { "aria-hidden": "true" } });
  const img = el(doc, "img", { className: "bank-logo", attrs: { src, alt: "", loading: "lazy" } });
  img.addEventListener("error", () => img.classList.add("bank-logo--empty"));
  return img;
}

function cardsView(doc, s, storage, meta = {}) {
  const logoUrl = meta.logoUrl ?? (() => null);
  const view = [];
  const promos = s.promos ?? [];
  if (!promos.length) {
    view.push(el(doc, "div", { className: "empty" }, [
      el(doc, "p", { className: "empty-title", textContent: "Todavía no hay promos" }),
      el(doc, "p", { textContent: "Abrí coto.com.ar una vez para cargar las promos de los bancos." }),
    ]));
    return view;
  }

  // Día de compra: chips de radio.
  const current = typeof s.day === "number" ? String(s.day) : "hoy";
  const days = el(doc, "fieldset", { className: "days" }, [el(doc, "legend", { textContent: "Día de compra" })]);
  const options = [["hoy", "Hoy"], ...[0, 1, 2, 3, 4, 5, 6].map((d) => [String(d), dayName(d).slice(0, 3)])];
  for (const [value, text] of options) {
    const input = el(doc, "input", { type: "radio", name: "day", value, checked: value === current });
    input.addEventListener("change", () => storage.set({ day: value === "hoy" ? "hoy" : Number(value) }));
    const title = value === "hoy" ? "Hoy" : dayName(Number(value));
    days.append(el(doc, "label", { className: "chip", title }, [input, el(doc, "span", { textContent: text })]));
  }
  view.push(days);

  const selected = new Set(s.selectedPromoIds ?? []);
  const summary = el(doc, "p", { className: "summary", attrs: { "aria-live": "polite" } });
  const updateSummary = () => {
    summary.textContent = selected.size ? plural(selected.size, "promo elegida", "promos elegidas") : "Marcá las promos de tus tarjetas";
  };
  updateSummary();

  const search = el(doc, "input", { type: "search", placeholder: "Buscar banco", className: "search", attrs: { "aria-label": "Buscar banco" } });
  view.push(el(doc, "div", { className: "toolbar" }, [search, summary]));

  const byBank = new Map();
  for (const p of promos) {
    if (!byBank.has(p.bank)) byBank.set(p.bank, []);
    byBank.get(p.bank).push(p);
  }
  const list = el(doc, "div", { className: "banks" });
  const rows = [];
  // Primero los bancos con promos elegidas, después por nombre.
  const chosen = ([, items]) => (items.some((p) => selected.has(p.id)) ? 0 : 1);
  const order = [...byBank].sort((a, b) => chosen(a) - chosen(b) || a[0].localeCompare(b[0]));
  for (const [bank, items] of order) {
    const count = el(doc, "span", { className: "count" });
    const updateCount = () => {
      const n = items.filter((p) => selected.has(p.id)).length;
      count.textContent = n ? String(n) : "";
      count.hidden = !n;
    };
    const details = el(doc, "details", { className: "bank", open: items.some((p) => selected.has(p.id)) }, [
      el(doc, "summary", {}, [bankLogo(doc, items, logoUrl), el(doc, "span", { className: "bank-name", textContent: bank }), count, icon(doc, ["M6 9l6 6l6-6"])]),
    ]);
    for (const p of items) {
      const box = switchInput(doc, { value: p.id, checked: selected.has(p.id) });
      box.addEventListener("change", () => {
        if (box.checked) selected.add(p.id);
        else selected.delete(p.id);
        updateCount();
        updateSummary();
        storage.set({ selectedPromoIds: [...selected] });
      });
      details.append(el(doc, "label", { className: "row", title: p.text }, [el(doc, "span", { className: "row-text", textContent: describe(p) }), box]));
    }
    updateCount();
    rows.push({ name: norm(bank), details });
    list.append(details);
  }
  const noMatch = el(doc, "p", { className: "empty-search", textContent: "Ningún banco con ese nombre", hidden: true });
  search.addEventListener("input", () => {
    const q = norm(search.value.trim());
    let shown = 0;
    for (const r of rows) {
      r.details.hidden = !!q && !r.name.includes(q);
      if (!r.details.hidden) shown++;
    }
    noMatch.hidden = shown > 0;
  });
  view.push(list, noMatch);
  return view;
}

function settingsView(doc, s, storage) {
  return SETTINGS.map(({ key, title, text }) => {
    const box = switchInput(doc, { name: key, checked: s[key] !== false });
    box.addEventListener("change", () => storage.set({ [key]: box.checked }));
    return el(doc, "label", { className: "setting" }, [
      el(doc, "span", { className: "setting-text" }, [el(doc, "span", { className: "setting-title", textContent: title }), el(doc, "span", { className: "setting-desc", textContent: text })]),
      box,
    ]);
  });
}

function helpView(doc, meta) {
  return [
    el(doc, "dl", { className: "help" }, HELP.flatMap(([t, d]) => [el(doc, "dt", { textContent: t }), el(doc, "dd", { textContent: d })])),
    el(doc, "p", { className: "legal" }, [
      el(doc, "strong", { textContent: "No afiliado a Coto." }),
      " Usa los datos de coto.com.ar. Para comparar, solo envía códigos de barras a Carrefour, Día y Más.",
    ]),
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

// storage: misma interfaz que en bridge.js. meta: { version }.
export async function renderPopup(doc, storage, meta = {}) {
  const s = await storage.get(["promos", "selectedPromoIds", "day", "autoPromo", "notifyPromo", "markBest", "comunidad", "compareStores", "nutrition", "popupTab"]);
  let active = TABS.some((t) => t.id === s.popupTab) ? s.popupTab : "tarjetas";

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
}
