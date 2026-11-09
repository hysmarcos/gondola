// Ventana de la extensión: elegir promos bancarias y día de compra.
import { dayName } from "./banks.js";

const money = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });

function describe(p) {
  const days = p.days.map(dayName).join(", ");
  const cap = p.cap ? `tope $${money.format(p.cap)}${p.capWeekly ? " por semana" : ""}` : "sin tope";
  const only = p.onlyNoOffer ? " · solo sin oferta" : "";
  return `${days} · ${p.percent}% · ${cap}${only}`;
}

function el(doc, tag, props = {}, children = []) {
  const e = doc.createElement(tag);
  Object.assign(e, props);
  for (const c of children) e.append(c);
  return e;
}

// storage: misma interfaz que en bridge.js.
export async function renderPopup(doc, storage) {
  const s = await storage.get(["promos", "selectedPromoIds", "day"]);
  const root = el(doc, "main");
  root.append(el(doc, "h1", { textContent: "Coto precio por unidad" }));

  const promos = s.promos ?? [];
  if (!promos.length) {
    root.append(el(doc, "p", { textContent: "Abrí coto.com.ar una vez para cargar las promos" }));
    doc.body.replaceChildren(root);
    return;
  }

  const select = el(doc, "select", { id: "day" }, [
    el(doc, "option", { value: "hoy", textContent: "Hoy" }),
    ...[0, 1, 2, 3, 4, 5, 6].map((d) => el(doc, "option", { value: String(d), textContent: dayName(d) })),
  ]);
  select.value = typeof s.day === "number" ? String(s.day) : "hoy";
  select.addEventListener("change", () => {
    storage.set({ day: select.value === "hoy" ? "hoy" : Number(select.value) });
  });
  root.append(el(doc, "label", { className: "day" }, ["Día de compra ", select]));
  root.append(el(doc, "p", { className: "hint", textContent: "Marcá las promos de tus tarjetas:" }));

  const selected = new Set(s.selectedPromoIds ?? []);
  const byBank = new Map();
  for (const p of promos) {
    if (!byBank.has(p.bank)) byBank.set(p.bank, []);
    byBank.get(p.bank).push(p);
  }
  for (const [bank, list] of [...byBank].sort(([a], [b]) => a.localeCompare(b))) {
    const section = el(doc, "section", {}, [el(doc, "h2", { textContent: bank })]);
    for (const p of list) {
      const box = el(doc, "input", { type: "checkbox", value: p.id, checked: selected.has(p.id) });
      box.addEventListener("change", () => {
        if (box.checked) selected.add(p.id);
        else selected.delete(p.id);
        storage.set({ selectedPromoIds: [...selected] });
      });
      section.append(el(doc, "label", { title: p.text }, [box, " " + describe(p)]));
    }
    root.append(section);
  }
  doc.body.replaceChildren(root);
}
