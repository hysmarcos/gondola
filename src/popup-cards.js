// Pestaña Tarjetas: una sola lista de tarjetas. Cada una dice qué da en Coto y en los otros súper.
import { dayName, isComunidad } from "./banks.js";
import { CARDS, cleanCards, applies, migrateCards, cotoCards } from "./cards.js";
import { cardOf } from "./bank-rules/coto.js";
import { STORES } from "./stores.js";
import { el, icon, plural, norm, switchInput } from "./popup-dom.js";

const money = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });
const COTO = { id: "coto", name: "Coto" };
const WHY = { unclear: "sin número claro", changed: "los términos cambiaron" };

// "Miércoles · 25% · tope $9.500". Sirve para promos de Coto y de los otros súper.
function describe(p) {
  const days = (p.days ?? []).map(dayName).join(", ");
  const pct = typeof p.percent === "number" ? `${p.percent}%` : "";
  const cap = p.cap ? `tope $${money.format(p.cap)}${p.capWeekly ? " por semana" : ""}` : "sin tope";
  return [days, pct, cap, p.onlyNoOffer ? "solo sin oferta" : ""].filter(Boolean).join(" · ");
}

// Logo del banco (decorativo: el nombre va al lado). Si no carga, deja el lugar vacío.
function bankLogo(doc, logo, logoUrl) {
  const src = logo ? logoUrl(logo) : null;
  if (!src) return el(doc, "span", { className: "bank-logo bank-logo--empty", attrs: { "aria-hidden": "true" } });
  const img = el(doc, "img", { className: "bank-logo", attrs: { src, alt: "", loading: "lazy" } });
  img.addEventListener("error", () => img.classList.add("bank-logo--empty"));
  return img;
}

const link = (doc, store) => el(doc, "a", { className: "card-link", href: store.promosUrl, target: "_blank", rel: "noopener", textContent: `Ver en ${store.name}` });

// Una línea por súper: lo que la tarjeta elegida da ahí.
function storeLine(doc, store, entries) {
  const name = el(doc, "span", { className: "store-name", textContent: store.name });
  const line = el(doc, "div", { className: "card-store" }, entries === "error" ? ["No pudimos leer las promos de ", name] : [name]);
  line.dataset.store = store.id;
  const text = (t) => line.append(" · ", el(doc, "span", { textContent: t }));
  if (entries === "error") { /* el texto ya está */ }
  else if (!entries.length) text("sin promo online");
  else {
    const ok = entries.filter((e) => e.status === "ok").map((e) => describe(e.promo));
    if (ok.length) text(ok.join("; "));
    for (const e of entries) if (e.status !== "ok") text(`${e.promo.title ? `${e.promo.title}: ` : ""}${WHY[e.status] ?? "sin número claro"}`);
  }
  if (store.promosUrl && (entries === "error" || entries.some((e) => e.status !== "ok"))) line.append(" ", link(doc, store));
  return line;
}

export function cardsView(doc, s, storage, meta = {}) {
  const logoUrl = meta.logoUrl ?? (() => null);
  // Sin tarjetas guardadas todavía, se parte de las promos elegidas a mano (el puente lo guarda al abrir Coto).
  const cards = cleanCards(s.cards ?? migrateCards(s, cardOf) ?? {}, s.promos);
  // CARDS y los bancos de Coto que no están ahí (HSBC, o uno nuevo).
  const all = [...CARDS, ...cotoCards(s.promos)];
  const known = (id) => all.some((c) => c.id === id);

  // Comunidad Coto no va acá: se prende en Ajustes ("Tengo Comunidad Coto").
  const coto = [];
  for (const promo of (s.promos ?? []).filter((p) => !isComunidad(p))) {
    const ref = cardOf(promo);
    if (ref && known(ref.cardId)) coto.push({ promo, ref, status: "ok", logo: promo.logo });
  }
  const data = meta.storePromos ?? {};
  const shown = (meta.stores ?? STORES).filter((st) => st.id in data);
  const stores = [COTO, ...shown];
  const entriesOf = (st) => (st.id === COTO.id ? coto : data[st.id]);
  const mapped = (st) => {
    const e = entriesOf(st);
    return Array.isArray(e) ? e.filter((x) => x.status !== "unmapped" && x.ref && known(x.ref.cardId)) : [];
  };

  const view = [];
  // Una tarjeta prendida va siempre, aunque no tenga promo: se tiene que poder apagar.
  const listed = all.filter((c) => c.id in cards || stores.some((st) => mapped(st).some((e) => e.ref.cardId === c.id)));
  const unmapped = shown.flatMap((st) => (Array.isArray(data[st.id]) ? data[st.id] : []).filter((e) => e.status === "unmapped").map((e) => ({ st, e })));
  if (!listed.length && !unmapped.length) {
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

  const summary = el(doc, "p", { className: "summary", attrs: { "aria-live": "polite" } });
  const updateSummary = () => {
    const n = Object.keys(cards).length;
    summary.textContent = n ? plural(n, "tarjeta elegida", "tarjetas elegidas") : "Marcá tus tarjetas";
  };
  updateSummary();
  const search = el(doc, "input", { type: "search", placeholder: "Buscar banco", className: "search", attrs: { "aria-label": "Buscar banco" } });
  view.push(el(doc, "div", { className: "toolbar" }, [search, summary]));

  const list = el(doc, "div", { className: "banks" });
  const rows = [];
  // Primero las tarjetas elegidas, después por nombre.
  const order = [...listed].sort((a, b) => (a.id in cards ? 0 : 1) - (b.id in cards ? 0 : 1) || a.name.localeCompare(b.name));
  for (const card of order) {
    const logo = coto.find((e) => e.ref.cardId === card.id)?.logo;
    const box = switchInput(doc, { checked: card.id in cards, attrs: { "aria-label": card.name } });
    const body = el(doc, "div", { className: "card-body" });
    const details = el(doc, "details", { className: "bank", open: card.id in cards }, [
      el(doc, "summary", {}, [bankLogo(doc, logo, logoUrl), el(doc, "span", { className: "bank-name", textContent: card.name }), box, icon(doc, ["M6 9l6 6l6-6"])]),
      body,
    ]);
    details.dataset.card = card.id;

    const paint = () => {
      const on = card.id in cards;
      // Apagada, muestra lo que da sin elegir plan.
      const mine = on ? cards : { [card.id]: { plan: null } };
      const parts = [];
      if (on && card.plans.length) {
        const plans = el(doc, "fieldset", { className: "plans" }, [el(doc, "legend", { className: "sr-only", textContent: `Plan de ${card.name}` })]);
        for (const [value, text] of [["", "General"], ...card.plans.map((p) => [p.id, p.name])]) {
          const input = el(doc, "input", { type: "radio", name: `plan-${card.id}`, value, checked: value === (cards[card.id].plan ?? "") });
          input.addEventListener("change", () => {
            cards[card.id] = { plan: value || null };
            storage.set({ cards: structuredClone(cards) });
            paint();
          });
          plans.append(el(doc, "label", { className: "chip" }, [input, el(doc, "span", { textContent: text })]));
        }
        parts.push(plans);
      }
      for (const st of stores) {
        if (entriesOf(st) === "error") parts.push(storeLine(doc, st, "error"));
        else parts.push(storeLine(doc, st, mapped(st).filter((e) => e.ref.cardId === card.id && applies(mine, e.ref))));
      }
      body.replaceChildren(...parts);
    };
    paint();

    box.addEventListener("change", () => {
      if (box.checked) {
        cards[card.id] = { plan: null };
        details.open = true;
      } else delete cards[card.id];
      storage.set({ cards: structuredClone(cards) });
      updateSummary();
      paint();
    });
    rows.push({ name: norm(card.name), details });
    list.append(details);
  }

  const noMatch = el(doc, "p", { className: "empty-search", textContent: "Ningún banco con ese nombre", hidden: true });
  search.addEventListener("input", () => {
    const q = norm(search.value.trim());
    let n = 0;
    for (const r of rows) {
      r.details.hidden = !!q && !r.name.includes(q);
      if (!r.details.hidden) n++;
    }
    noMatch.hidden = n > 0;
  });
  view.push(list, noMatch);

  // Promos que no sabemos de qué tarjeta son: se muestran sin interruptor.
  if (unmapped.length) {
    const items = unmapped.map(({ st, e }) => el(doc, "li", {}, [el(doc, "span", { textContent: `${e.promo.title ?? e.promo.text ?? "Promo"} · ${st.name}` }), " ", link(doc, st)]));
    view.push(el(doc, "section", { className: "others" }, [el(doc, "h2", { className: "others-title", textContent: "Otras promos" }), el(doc, "ul", {}, items)]));
  }
  return view;
}
