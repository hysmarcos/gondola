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
  return stores.map(({ id, name, host }) => {
    const row = { id, name, state: "none", unit: null, qty: 1, title: null, url: null, delta: null, cotoUnit: cmp.unit, cotoQty: cmp.qty ?? 1 };
    if (results === undefined) return { ...row, state: "pending" };
    const offer = results[id];
    if (offer === "missing") return { ...row, title: `No está en ${name}` };
    if (!offer || typeof offer !== "object" || !Number.isFinite(offer.unit)) {
      return { ...row, title: `No se pudo consultar ${name}` };
    }
    const ratio = offer.unit / cmp.unit;
    if (!(ratio >= MIN_RATIO && ratio <= MAX_RATIO)) return { ...row, title: "Dato dudoso" };
    return {
      ...row,
      state: classify(cmp.unit, offer.unit),
      unit: offer.unit,
      qty: offer.qty > 1 ? offer.qty : 1,
      url: safeUrl(offer.url, host),
      delta: Math.round(((offer.unit - cmp.unit) / cmp.unit) * 100),
    };
  });
}

// Solo links https al mismo súper: nada de otros sitios ni javascript:.
function safeUrl(url, host) {
  try {
    const u = new URL(String(url));
    return u.protocol === "https:" && u.hostname === host ? u.href : null;
  } catch {
    return null;
  }
}

// Estado general para el ícono: hay un súper más barato (worse), Coto es el más barato
// (better), todos igual (equal), sin datos (none) o consultando (pending).
export function compareStatus(rows) {
  if (!rows?.length) return "none";
  if (rows.some((r) => r.state === "lower")) return "worse";
  if (rows.some((r) => r.state === "higher")) return "better";
  if (rows.some((r) => r.state === "equal")) return "equal";
  if (rows.some((r) => r.state === "pending")) return "pending";
  return "none";
}

const STATUS_TEXT = {
  worse: "Hay un súper más barato",
  better: "Coto tiene el mejor precio",
  equal: "Mismo precio en otros súper",
  none: "Sin datos de otros súper",
  pending: "Consultando otros súper",
};

// Pastilla: una palabra corta que se entiende sin pensar, con un ícono de apoyo.
const STATUS_ICON = {
  better: ["M5 12.5l4.2 4.2L19 7"],
  worse: ["M3 12V5a2 2 0 0 1 2-2h7l9 9-9 9z", "M7.5 7.5h.01"],
  equal: ["M6 10h12", "M6 14h12"],
  none: [],
  pending: ["M6 12h.01", "M12 12h.01", "M18 12h.01"],
};

// Texto de la pastilla. En "worse" nombra el súper más barato.
function pillText(state, rows) {
  if (state === "worse") {
    const best = rows.filter((r) => r.state === "lower").reduce((a, b) => (b.unit < a.unit ? b : a));
    return `Más barato en ${best.name}`;
  }
  return { better: "Mejor precio", equal: "Igual", none: "Sin comparar", pending: "Comparando…" }[state];
}

function priceText(r) {
  if (r.unit !== null) return formatMoney(r.unit);
  if (r.state === "pending") return "…";
  return (r.title ?? "").startsWith("No está") ? "No está" : "Sin datos";
}

function deltaText(r) {
  if (r.unit === null) return null;
  if (r.state === "equal" || r.delta === 0) return "igual";
  return `${r.delta < 0 ? "−" : "+"}${Math.abs(r.delta)}%`;
}

function iconPlan(rows, withLogo) {
  const state = compareStatus(rows);
  const first = rows[0];
  const text = pillText(state, rows);
  return {
    kind: "icon",
    state,
    text,
    label: `${state === "worse" ? text : STATUS_TEXT[state]}. Ver comparación`,
    rows: [
      { name: "Coto", ...withLogo("coto"), url: null, state: "coto", price: formatMoney(first.cotoUnit), qty: first.cotoQty > 1 ? `x${first.cotoQty}` : null, delta: null },
      ...rows.map((r) => ({ name: r.name, ...withLogo(r.id), url: r.url, state: r.state, price: priceText(r), qty: r.qty > 1 ? `x${r.qty}` : null, delta: deltaText(r) })),
    ],
  };
}

function svgIcon(doc, paths) {
  const NS = "http://www.w3.org/2000/svg";
  const svg = doc.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  for (const d of paths) {
    const p = doc.createElementNS(NS, "path");
    p.setAttribute("d", d);
    svg.append(p);
  }
  return svg;
}

// El logo del súper. Solo (name): reemplaza al nombre en la línea corta de los carruseles y
// del carrito; el nombre queda como texto alternativo y como globo al pasar el mouse. Junto
// al nombre escrito (sin name): es decorativo.
function logoImg(doc, url, name = "") {
  const img = doc.createElement("img");
  img.className = `${CMP}-logo`;
  img.src = url;
  img.alt = name;
  if (name) img.title = name;
  img.width = 18;
  img.height = 18;
  return img;
}

// El súper de una fila: su logo y su nombre (solo el nombre, si no hay logo). Con link (solo
// https al mismo súper, ver safeUrl), abre su página.
function nameNode(doc, { name, logo, url }) {
  const node = doc.createElement(url ? "a" : "span");
  node.className = logo ? `${CMP}-name ${CMP}-name--logo` : `${CMP}-name`;
  if (logo) node.append(logoImg(doc, logo), el(doc, "span", `${CMP}-label`, name));
  else node.textContent = name;
  if (url) {
    node.setAttribute("href", url);
    node.setAttribute("target", "_blank");
    node.setAttribute("rel", "noopener noreferrer");
  }
  return node;
}

function el(doc, tag, cls, text) {
  const e = doc.createElement(tag);
  e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

function buildIcon(doc, block, it) {
  const btn = el(doc, "button", `${CMP}-btn`);
  btn.type = "button";
  btn.setAttribute("aria-label", it.label);
  btn.setAttribute("aria-expanded", block.hasAttribute("data-open") ? "true" : "false");
  if (STATUS_ICON[it.state].length) btn.append(svgIcon(doc, STATUS_ICON[it.state]));
  btn.append(el(doc, "span", `${CMP}-text`, it.text));
  const pop = el(doc, "div", `${CMP}-pop`);
  pop.setAttribute("role", "group");
  pop.setAttribute("aria-label", "Mismo producto en otros súper");
  pop.append(el(doc, "div", `${CMP}-head`, "Mismo producto en otros súper"));
  for (const r of it.rows) {
    const row = el(doc, "div", `${CMP}-row ${CMP}-row--${r.state}`);
    row.append(nameNode(doc, r), el(doc, "span", `${CMP}-price`, r.price));
    if (r.qty) row.append(el(doc, "span", `${CMP}-qty`, r.qty));
    if (r.delta) row.append(el(doc, "span", `${CMP}-delta`, r.delta));
    pop.append(row);
  }
  return [btn, pop];
}

// Abre/cierra el detalle al tocar (en celulares no hay hover). Se engancha una vez por bloque.
function wireToggle(block) {
  if (block.__cotoWired) return;
  block.__cotoWired = true;
  block.addEventListener("click", (e) => {
    const btn = e.target.closest?.(`.${CMP}-btn`);
    if (!btn || !block.contains(btn)) return;
    // La tarjeta de Coto navega al producto con un clic: el botón no debe dispararlo.
    e.preventDefault();
    e.stopPropagation();
    const open = !block.hasAttribute("data-open");
    if (open) block.setAttribute("data-open", "");
    else block.removeAttribute("data-open");
    btn.setAttribute("aria-expanded", String(open));
  });
}

// Lo que se va a dibujar, como datos simples: sirve de firma para no tocar el DOM
// si nada cambió (la página repinta en cada mutación).
function plan(rows, variant, logo) {
  // Sin logo no se agrega la clave: el plan (y su firma) queda igual que antes de los logos.
  const withLogo = (id) => (logo(id) ? { logo: logo(id) } : {});
  if (variant === "icon") return [iconPlan(rows, withLogo)];
  if (variant !== "mini") {
    // La más barata de las que le ganan a Coto lleva --best (la PDP con la piel la resalta).
    const lower = rows.filter((r) => r.state === "lower");
    const cheapest = lower.length ? lower.reduce((a, b) => (b.unit < a.unit ? b : a)) : null;
    return rows.map((r) => ({
      cls: `${CMP}-row ${CMP}-row--${r.state}${r === cheapest ? ` ${CMP}-row--best` : ""}`,
      name: r.name,
      ...withLogo(r.id),
      price: r.unit === null ? ICON[r.state] : `${ICON[r.state]} ${formatMoney(r.unit)}`,
      label: r.unit === null ? `${r.name}: ${r.title ?? "consultando"}` : `${r.name}: ${formatMoney(r.unit)}, ${SAYS[r.state]}`,
      title: r.title,
      qty: r.qty > 1 ? `llevando ${r.qty}` : null,
      ...(r.url ? { url: r.url } : {}),
    }));
  }
  const lower = rows.filter((r) => r.state === "lower");
  if (lower.length) {
    const best = lower.reduce((a, b) => (b.unit < a.unit ? b : a));
    const money = formatMoney(best.unit);
    // Si ese precio es llevando varios, se dice: sin eso el número engaña.
    const take = best.qty > 1 ? { text: ` (x${best.qty})`, label: `, llevando ${best.qty}` } : { text: "", label: "" };
    // Con logo, el logo reemplaza al nombre al principio de la línea.
    const mark = withLogo(best.id);
    return [
      {
        cls: `${CMP}-best ${CMP}-best--lower`,
        ...(mark.logo ? { logo: mark.logo, logoName: best.name, text: `${money} ▼${take.text}` } : { text: `${best.name} ${money} ▼${take.text}` }),
        label: `${best.name}: ${money}, más barato${take.label}`,
      },
    ];
  }
  if (rows.some((r) => r.unit !== null)) {
    const mark = withLogo("coto");
    return [
      {
        cls: `${CMP}-best ${CMP}-best--higher`,
        ...(mark.logo ? { logo: mark.logo, logoName: "Coto", text: "el más barato", label: "Coto el más barato" } : { text: "Coto el más barato" }),
      },
    ];
  }
  if (rows.some((r) => r.state === "pending")) return [{ cls: `${CMP}-best ${CMP}-best--pending`, text: "…" }];
  return null;
}

function build(doc, items, block) {
  if (items[0]?.kind === "icon") return buildIcon(doc, block, items[0]);
  const nodes = [];
  for (const it of items) {
    const el = doc.createElement("div");
    el.className = it.cls;
    if (it.label) el.setAttribute("aria-label", it.label);
    if (it.title) el.setAttribute("title", it.title);
    if ("text" in it) {
      if (it.logo) el.append(logoImg(doc, it.logo, it.logoName), it.text);
      else el.textContent = it.text;
    } else {
      const price = doc.createElement("span");
      price.className = `${CMP}-price`;
      price.textContent = it.price;
      el.append(nameNode(doc, it), price);
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
// opts.logo(id) → URL del logo del súper ("coto", "carrefour"…) o null: sin logo, va solo el nombre.
export function paintCompare(box, rows, variant = "", opts = {}) {
  const logo = (id) => opts.logo?.(id) ?? null;
  let block = box.querySelector(`:scope > .${CMP}`);
  const items = rows?.length ? plan(rows, variant, logo) : null;
  if (!items) return block?.remove();
  const sig = JSON.stringify(items);
  if (!block) {
    block = box.ownerDocument.createElement("div");
    block.className = CMP;
  }
  if (variant === "icon") {
    if (!block.classList.contains(`${CMP}--icon`)) block.classList.add(`${CMP}--icon`);
    if (block.dataset.state !== items[0].state) block.dataset.state = items[0].state;
    wireToggle(block);
  }
  if (block.getAttribute(SIG) !== sig) {
    block.replaceChildren(...build(box.ownerDocument, items, block));
    block.setAttribute(SIG, sig);
  }
  if (box.lastChild !== block) box.appendChild(block);
  return block;
}
