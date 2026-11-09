// Filas "en otros súper" dentro de la caja de precio para comparar. Solo agrega un
// bloque .coto-unit-cmp al final de la caja; no toca nada de Coto.
import { STORES } from "./stores.js";
import { classify } from "./compare.js";
import { formatMoney } from "./money.js";

const CMP = "coto-unit-cmp";
const SIG = "data-coto-unit-sig";
// Más lejos que esto del precio de Coto es casi seguro otro producto o un error.
const MIN_RATIO = 0.4;
const MAX_RATIO = 2.5;

const ICON = { lower: "▼", equal: "=", higher: "▲", none: "—", pending: "…" };
const SAYS = { lower: "más barato", equal: "igual", higher: "más caro" };

// cmp: { unit, qty } de Coto. results: StoreResults del cliente, o undefined si no llegó.
export function compareRows(cmp, results, stores = STORES) {
  return stores.map(({ id, name }) => {
    const row = { id, name, state: "none", unit: null, qty: 1, title: null };
    if (results === undefined) return { ...row, state: "pending" };
    const offer = results[id];
    if (offer === "missing") return { ...row, title: `No está en ${name}` };
    if (!offer || typeof offer !== "object" || !Number.isFinite(offer.unit)) {
      return { ...row, title: `No se pudo consultar ${name}` };
    }
    const ratio = offer.unit / cmp.unit;
    if (!(ratio >= MIN_RATIO && ratio <= MAX_RATIO)) return { ...row, title: "Dato dudoso" };
    return { ...row, state: classify(cmp.unit, offer.unit), unit: offer.unit, qty: offer.qty > 1 ? offer.qty : 1 };
  });
}

// Lo que se va a dibujar, como datos simples: sirve de firma para no tocar el DOM
// si nada cambió (la página repinta en cada mutación).
function plan(rows, variant) {
  if (variant !== "mini") {
    return rows.map((r) => ({
      cls: `${CMP}-row ${CMP}-row--${r.state}`,
      name: r.name,
      price: r.unit === null ? ICON[r.state] : `${ICON[r.state]} ${formatMoney(r.unit)}`,
      label: r.unit === null ? `${r.name}: ${r.title ?? "consultando"}` : `${r.name}: ${formatMoney(r.unit)}, ${SAYS[r.state]}`,
      title: r.title,
      qty: r.qty > 1 ? `llevando ${r.qty}` : null,
    }));
  }
  const lower = rows.filter((r) => r.state === "lower");
  if (lower.length) {
    const best = lower.reduce((a, b) => (b.unit < a.unit ? b : a));
    const money = formatMoney(best.unit);
    return [{ cls: `${CMP}-best ${CMP}-best--lower`, text: `${best.name} ${money} ▼`, label: `${best.name}: ${money}, más barato` }];
  }
  if (rows.some((r) => r.unit !== null)) return [{ cls: `${CMP}-best ${CMP}-best--higher`, text: "Coto el más barato" }];
  if (rows.some((r) => r.state === "pending")) return [{ cls: `${CMP}-best ${CMP}-best--pending`, text: "…" }];
  return null;
}

function build(doc, items) {
  const nodes = [];
  for (const it of items) {
    const el = doc.createElement("div");
    el.className = it.cls;
    if (it.label) el.setAttribute("aria-label", it.label);
    if (it.title) el.setAttribute("title", it.title);
    if ("text" in it) {
      el.textContent = it.text;
    } else {
      const name = doc.createElement("span");
      name.className = `${CMP}-name`;
      name.textContent = it.name;
      const price = doc.createElement("span");
      price.className = `${CMP}-price`;
      price.textContent = it.price;
      el.append(name, price);
    }
    nodes.push(el);
    if (it.qty) {
      const qty = doc.createElement("div");
      qty.className = `${CMP}-qty`;
      qty.textContent = it.qty;
      nodes.push(qty);
    }
  }
  return nodes;
}

// Crea o actualiza el bloque como último hijo de box. Sin filas, lo borra.
export function paintCompare(box, rows, variant = "") {
  let block = box.querySelector(`:scope > .${CMP}`);
  const items = rows?.length ? plan(rows, variant) : null;
  if (!items) return block?.remove();
  const sig = JSON.stringify(items);
  if (!block) {
    block = box.ownerDocument.createElement("div");
    block.className = CMP;
  }
  if (block.getAttribute(SIG) !== sig) {
    block.replaceChildren(...build(box.ownerDocument, items));
    block.setAttribute(SIG, sig);
  }
  if (box.lastChild !== block) box.appendChild(block);
  return block;
}
