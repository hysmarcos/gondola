// Bloque "Información nutricional" de la página de producto.
// Los datos llegan de Open Food Facts a través del service worker.
import qrcode from "qrcode-generator";
import { NUTRIENTS, ALLERGENS, offProductUrl } from "./nutrition.js";
import { taccStatus } from "./tacc.js";
import { paintGallery } from "./nutrition-gallery.js";

const ROOT = "coto-unit-nutri";
const num = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 });
const num2 = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 });
const int = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });
const month = new Intl.DateTimeFormat("es-AR", { month: "long", year: "numeric", timeZone: "America/Argentina/Buenos_Aires" });

// Valores diarios de referencia del Mercosur (dieta de 2000 kcal). Azúcares y grasas
// trans no tienen valor.
const VD = { kcal: 2000, carbs: 300, proteins: 75, fat: 55, saturatedFat: 22, fiber: 25, sodiumMg: 2400 };

// % del valor diario, entero, o null si el nutriente no tiene valor de referencia.
export function vdPercent(key, value) {
  return VD[key] && value !== undefined ? Math.round((value / VD[key]) * 100) : null;
}

// "Envase de 400 g · 13 porciones de 30 g · 1.920 kcal en total", o null sin tamaño.
// label.amount: tamaño del envase en kg o L.
export function packageLine(n, label, liquid) {
  if (!(label?.amount > 0)) return null;
  const grams = label.amount * 1000;
  const size = grams >= 1000 ? `${num2.format(label.amount)} ${liquid ? "L" : "kg"}` : `${Math.round(grams)} ${liquid ? "ml" : "g"}`;
  const parts = [`Envase de ${size}`];
  const portions = n.servingQty > 0 ? Math.round(grams / n.servingQty) : 0;
  if (portions >= 1 && portions <= 100) {
    parts.push(`${portions} ${portions === 1 ? "porción" : "porciones"} de ${num.format(n.servingQty)} ${liquid ? "ml" : "g"}`);
  }
  if (n.per100.kcal !== undefined) parts.push(`${int.format((n.per100.kcal * grams) / 100)} kcal en total`);
  return parts.join(" · ");
}

// "Rinde: $X cada 100 g de proteína · $Y cada 1000 kcal", con el precio real por kg o L.
export function valueLine(n, label) {
  if (label?.group !== "kg" && label?.group !== "L") return null;
  const perKg = label.bankValue ?? label.value;
  if (!(perKg > 0)) return null;
  const parts = [];
  const { proteins, kcal } = n.per100;
  if (proteins >= 5) parts.push(`$${int.format((perKg * 10) / proteins)} cada 100 g de proteína`);
  if (kcal >= 50) parts.push(`$${int.format((perKg * 100) / kcal)} cada 1000 kcal`);
  return parts.length ? `Rinde: ${parts.join(" · ")}` : null;
}

// "Actualizado en marzo de 2026", o null.
export function updatedText(ms) {
  return ms > 0 ? `Actualizado en ${month.format(new Date(ms))}` : null;
}

// kcal y mg sin decimales; gramos con hasta un decimal ("70,3 g").
function format(value, unit) {
  if (value === undefined) return "";
  return `${unit === "g" ? num.format(value) : Math.round(value)} ${unit}`;
}

function el(doc, tag, className, text) {
  const e = doc.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}

function link(doc, href, text) {
  const a = el(doc, "a", null, text);
  a.href = href;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  return a;
}

function table(doc, n, base) {
  const t = el(doc, "table", `${ROOT}-table`);
  const head = el(doc, "tr");
  head.append(el(doc, "th"), el(doc, "th", null, `cada ${base}`));
  if (n.perServing) head.append(el(doc, "th", null, n.servingSize ? `Por porción (${n.servingSize})` : "Por porción"), el(doc, "th", null, "%VD"));
  t.append(el(doc, "thead"));
  t.tHead.append(head);
  const body = el(doc, "tbody");
  for (const [key, , name, unit] of NUTRIENTS) {
    const a = n.per100[key];
    const b = n.perServing?.[key];
    if (a === undefined && b === undefined) continue;
    const tr = el(doc, "tr");
    tr.append(el(doc, "td", null, name), el(doc, "td", null, format(a, unit)));
    if (n.perServing) {
      const vd = vdPercent(key, b);
      tr.append(el(doc, "td", null, format(b, unit)), el(doc, "td", null, vd === null ? "" : `${vd}%`));
    }
    body.append(tr);
  }
  t.append(body);
  return t;
}

const vdNote = (doc, n) => (n.perServing ? [el(doc, "p", `${ROOT}-note`, "%VD: con base en una dieta de 2000 kcal")] : []);

const NOVA = {
  1: "NOVA 1: sin procesar o mínimamente procesado",
  2: "NOVA 2: ingrediente culinario procesado",
  3: "NOVA 3: procesado",
  4: "NOVA 4: ultraprocesado",
};

// Chip de alérgeno: ícono de la FSA (si hay assetUrl) y nombre en español.
function chip(doc, key, assetUrl) {
  const c = el(doc, "span", `${ROOT}-chip`);
  if (assetUrl) {
    const i = el(doc, "img", `${ROOT}-chip-icon`);
    i.src = assetUrl(`assets/allergens/${key}.png`);
    i.alt = "";
    i.width = 20;
    i.height = 20;
    c.append(i);
  }
  c.append(ALLERGENS[key]);
  return c;
}

// Sin TACC, alérgenos, ingredientes, aditivos y NOVA. fsa: si se usaron íconos de la FSA.
function extras(doc, n, label, assetUrl) {
  const nodes = [];
  const status = taccStatus(label?.tacc ?? null, label?.name, n);
  const tacc = el(doc, "p", `${ROOT}-tacc ${ROOT}-tacc--${status.kind}`);
  tacc.append(el(doc, "strong", null, "Sin TACC: "), `${status.text}. `, el(doc, "span", `${ROOT}-hint`, "Verificá el símbolo oficial en el envase."));
  nodes.push(tacc);

  const box = el(doc, "div", `${ROOT}-allergens`);
  box.append(el(doc, "strong", null, "Alérgenos"));
  const allergens = n.allergens ?? [];
  const traces = n.traces ?? [];
  for (const [title, keys] of [["Declara:", allergens], ["Puede contener:", traces]]) {
    if (!keys.length) continue;
    const p = el(doc, "p", `${ROOT}-chips`);
    p.append(`${title} `, ...keys.map((k) => chip(doc, k, assetUrl)));
    box.append(p);
  }
  if (!allergens.length && !traces.length) box.append(el(doc, "p", null, "Sin datos de alérgenos."));
  box.append(el(doc, "p", `${ROOT}-hint`, "Revisá el envase: los datos los carga la comunidad."));
  nodes.push(box);

  if (n.ingredients) {
    const d = el(doc, "details", `${ROOT}-ingredients`);
    d.append(el(doc, "summary", null, "Ingredientes"), el(doc, "p", null, n.ingredients.spanish ? n.ingredients.text : `${n.ingredients.text} (en otro idioma)`));
    nodes.push(d);
  }
  if (n.additives?.length) nodes.push(el(doc, "p", `${ROOT}-additives`, `Aditivos: ${n.additives.join(", ")}`));
  if (NOVA[n.nova]) nodes.push(el(doc, "p", `${ROOT}-nova`, NOVA[n.nova]));
  return { nodes, fsa: Boolean(assetUrl && (allergens.length || traces.length)) };
}

// Pie: fuente, fotos del envase, fecha de actualización y link para corregir.
function source(doc, n, fsa = false) {
  const nodes = [];
  const foot = el(doc, "p", `${ROOT}-source`, "Fuente: Open Food Facts, datos cargados por la comunidad. ");
  foot.append(link(doc, n.url, "Ver ficha"));
  nodes.push(foot);
  const photos = [["frente", n.photos?.front], ["tabla", n.photos?.nutrition], ["ingredientes", n.photos?.ingredients]].filter(([, url]) => url);
  if (photos.length) {
    const p = el(doc, "p", `${ROOT}-photos`, "Fotos del envase: ");
    photos.forEach(([name, url], i) => p.append(...(i ? [" · "] : []), link(doc, url, name)));
    nodes.push(p);
  }
  const meta = el(doc, "p", `${ROOT}-meta`);
  const updated = updatedText(n.updatedAt);
  if (updated) meta.append(`${updated} · `);
  meta.append(link(doc, n.url, "Corregir en Open Food Facts"));
  nodes.push(meta);
  if (fsa) nodes.push(el(doc, "p", `${ROOT}-meta`, "Íconos de alérgenos: Food Standards Agency (Reino Unido), Open Government Licence v3.0."));
  return nodes;
}

// QR con la URL de la ficha, dibujado con nodos SVG (sin innerHTML ni imágenes de afuera).
function qrSvg(doc, url) {
  const NS = "http://www.w3.org/2000/svg";
  const qr = qrcode(0, "M");
  qr.addData(url);
  qr.make();
  const n = qr.getModuleCount();
  const pad = 4;
  let d = "";
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) d += `M${c + pad} ${r + pad}h1v1h-1z`;
  const svg = doc.createElementNS(NS, "svg");
  svg.setAttribute("class", `${ROOT}-qr`);
  svg.setAttribute("viewBox", `0 0 ${n + pad * 2} ${n + pad * 2}`);
  svg.setAttribute("width", "112");
  svg.setAttribute("height", "112");
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", `Código QR de ${url}`);
  const bg = doc.createElementNS(NS, "rect");
  bg.setAttribute("width", "100%");
  bg.setAttribute("height", "100%");
  bg.setAttribute("class", `${ROOT}-qr-bg`);
  const path = doc.createElementNS(NS, "path");
  path.setAttribute("d", d);
  path.setAttribute("class", `${ROOT}-qr-dots`);
  svg.append(bg, path);
  return svg;
}

function missingLine(doc, ean, className) {
  const p = el(doc, "p", className);
  p.append("Sin información nutricional. ", link(doc, offProductUrl(ean), "Podés cargarla en Open Food Facts"));
  return p;
}

function icon(doc, src, alt) {
  const img = el(doc, "img", `${ROOT}-icon`);
  img.src = src;
  img.alt = alt;
  img.width = 20;
  img.height = 20;
  return img;
}

// Bloque desplegable para la columna de compra (páginas sin "Descripción del producto").
// result: Nutrition o "missing". Devuelve el nodo raíz del bloque.
export function renderNutrition(doc, result, { ean, liquid }) {
  if (result === "missing") {
    const p = missingLine(doc, ean, `${ROOT} ${ROOT}-missing`);
    p.dataset.ean = ean;
    return p;
  }
  const base = liquid ? "100 ml" : "100 g";
  const details = el(doc, "details", ROOT);
  details.dataset.ean = ean;
  const kcal = result.per100.kcal;
  details.append(el(doc, "summary", null, kcal === undefined ? "Información nutricional" : `Información nutricional · ${Math.round(kcal)} kcal cada ${base}`));
  details.append(table(doc, result, base), ...vdNote(doc, result), ...source(doc, result));
  return details;
}

// Texto del resumen: kcal, azúcares y sodio, los que haya. null si no hay ninguno.
export function summaryText(n, liquid) {
  const p = n.per100;
  const parts = [];
  if (p.kcal !== undefined) parts.push(`${Math.round(p.kcal)} kcal`);
  if (p.sugars !== undefined) parts.push(`${format(p.sugars, "g")} azúcares`);
  if (p.sodiumMg !== undefined) parts.push(`${format(p.sodiumMg, "mg")} sodio`);
  return parts.length ? `${parts.join(" · ")} · cada ${liquid ? "100 ml" : "100 g"}` : null;
}

// Línea de resumen para la columna de compra. "Ver tabla" baja a la sección sin tocar la URL.
function renderSummary(doc, n, { ean, liquid, iconUrl }) {
  const text = summaryText(n, liquid);
  if (!text) return null;
  const p = el(doc, "p", `${ROOT}-sum`);
  p.dataset.ean = ean;
  if (iconUrl) p.append(icon(doc, iconUrl, ""));
  p.append(el(doc, "span", `${ROOT}-text`, text));
  const more = el(doc, "button", `${ROOT}-more`, "Ver tabla");
  more.type = "button";
  more.addEventListener("click", () => doc.querySelector(`.${ROOT}-section`)?.scrollIntoView({ behavior: "smooth", block: "start" }));
  p.append(more);
  return p;
}

// Números grandes de la piel: [valor, leyenda] de calorías, proteínas, azúcares y sodio, los
// que haya. basis: "100" (cada 100 g o ml) o "portion". Las kcal van sin unidad: la dice la
// leyenda.
const TILES = [["proteins", "g", "proteínas"], ["sugars", "g", "azúcares"], ["sodiumMg", "mg", "sodio"]];
export function tileItems(n, basis, liquid) {
  const values = (basis === "portion" ? n.perServing : n.per100) ?? {};
  const items = [];
  if (values.kcal !== undefined) items.push([String(Math.round(values.kcal)), basis === "portion" ? "kcal por porción" : `kcal cada ${liquid ? "100 ml" : "100 g"}`]);
  for (const [key, unit, name] of TILES) if (values[key] !== undefined) items.push([format(values[key], unit), name]);
  return items;
}

function fillTiles(doc, box, n, basis, liquid) {
  box.replaceChildren(...tileItems(n, basis, liquid).map(([value, legend]) => {
    const tile = el(doc, "div", `${ROOT}-tile`);
    tile.append(el(doc, "span", `${ROOT}-tile-value`, value), el(doc, "span", `${ROOT}-tile-label`, legend));
    return tile;
  }));
}

// Piezas de la piel, antes de la tabla: interruptor (si hay porción) y números grandes. El
// interruptor cambia data-basis de la sección (el CSS oculta la columna que no va) y vuelve
// a dibujar solo los números.
function skinPieces(doc, sec, n, liquid) {
  sec.dataset.basis = "100";
  const tiles = el(doc, "div", `${ROOT}-tiles`);
  fillTiles(doc, tiles, n, "100", liquid);
  if (!n.perServing) return [tiles];
  const seg = el(doc, "div", `${ROOT}-seg`);
  seg.setAttribute("role", "group");
  seg.setAttribute("aria-label", "Valores de la tabla");
  const options = [["100", liquid ? "Cada 100 ml" : "Cada 100 g"], ["portion", "Por porción"]].map(([basis, text]) => {
    const b = el(doc, "button", null, text);
    b.type = "button";
    b.setAttribute("aria-pressed", String(basis === "100"));
    b.addEventListener("click", () => {
      if (sec.dataset.basis === basis) return;
      sec.dataset.basis = basis;
      for (const o of options) o.setAttribute("aria-pressed", String(o === b));
      fillTiles(doc, tiles, n, basis, liquid);
    });
    return b;
  });
  seg.append(...options);
  return [seg, tiles];
}

// Sección "Información nutricional" junto a la descripción del producto.
// skin: la piel de la PDP está prendida (suma el interruptor y los números grandes).
function renderSection(doc, result, { ean, liquid, iconUrl, label, assetUrl, taccKey, skin = false }) {
  const sec = el(doc, "section", `${ROOT}-section`);
  sec.dataset.ean = ean;
  // Estado Sin TACC con el que se dibujó: si cambia (llega el dato de Coto), se rehace.
  sec.dataset.tacc = taccKey;
  if (skin) sec.dataset.skin = "1";
  const h = el(doc, "h4", `${ROOT}-title`);
  if (iconUrl) h.append(icon(doc, iconUrl, "Open Food Facts"));
  h.append("Información nutricional");
  sec.append(h);
  if (result === "missing") {
    const url = offProductUrl(ean);
    const box = el(doc, "div", `${ROOT}-add`);
    box.append(qrSvg(doc, url), el(doc, "p", null, "Escaneá el código con el celular para cargarla con fotos del envase."));
    sec.append(missingLine(doc, ean, `${ROOT}-missing`), box);
    return sec;
  }
  const pack = packageLine(result, label, liquid);
  if (pack) sec.append(el(doc, "p", `${ROOT}-pack`, pack));
  const value = valueLine(result, label);
  if (value) sec.append(el(doc, "p", `${ROOT}-value`, value));
  if (skin) sec.append(...skinPieces(doc, sec, result, liquid));
  const more = extras(doc, result, label, assetUrl);
  sec.append(table(doc, result, liquid ? "100 ml" : "100 g"), ...vdNote(doc, result), ...more.nodes, ...source(doc, result, more.fsa));
  return sec;
}

const HOST = "data-coto-unit-nutri-host";

const lcfirst = (t) => t.charAt(0).toLowerCase() + t.slice(1);

// Ítems de "Para vos" según el perfil: [clase, texto]. n: Nutrition o null (sin tabla).
export function forYouItems(profile, label, n, liquid) {
  if (!profile) return [];
  const items = [];
  if (profile.celiac) {
    const st = taccStatus(label?.tacc ?? null, label?.name, n);
    items.push([st.kind, `${st.text}. Verificá el símbolo oficial en el envase.`]);
  }
  const mine = profile.allergens ?? [];
  if (mine.length) {
    const declared = n?.allergens ?? [];
    const traces = n?.traces ?? [];
    if (!declared.length && !traces.length) items.push(["unknown", "Sin datos de alérgenos: revisá el envase"]);
    for (const key of mine) {
      if (declared.includes(key)) items.push(["danger", `Declara ${lcfirst(ALLERGENS[key])}`]);
      else if (traces.includes(key)) items.push(["warn", `Puede contener ${lcfirst(ALLERGENS[key])}`]);
      // Que no figure no quiere decir que no tenga: los datos de la comunidad pueden estar incompletos.
      else if (declared.length || traces.length) items.push(["unknown", `${ALLERGENS[key]}: no figura (datos de la comunidad, revisá el envase)`]);
    }
  }
  const base = liquid ? "100 ml" : "100 g";
  if (profile.sodium && n?.per100?.sodiumMg !== undefined) items.push(["info", `Sodio: ${format(n.per100.sodiumMg, "mg")} cada ${base}`]);
  if (profile.sugar && n?.per100?.sugars !== undefined) items.push(["info", `Azúcares: ${format(n.per100.sugars, "g")} cada ${base}`]);
  return items;
}

// Explicación larga de cada etiqueta de la tarjeta (va en el title): el texto corto no es
// la única información.
const CARD_TAG_TITLE = {
  "Sin TACC": "Coto lo marca Sin TACC. Verificá el símbolo oficial en el envase.",
  "Sin TACC según OFF": "Según Open Food Facts, datos cargados por la comunidad. Verificá el símbolo oficial en el envase.",
  "Alergias: sin dato": "Open Food Facts no tiene datos de alérgenos de este producto. Revisá el envase.",
};

// Etiquetas "para vos" de la tarjeta de la lista: [tipo, texto, title], como máximo 2. Orden
// de prioridad: alérgenos declarados, trazas, "Revisá TACC", "sin dato" (alergias en el perfil
// y ningún dato de alérgenos: misma condición que forYouItems) y Sin TACC. Así una etiqueta
// neutra nunca saca un aviso. n: Nutrition o null (sin tabla o falló el pedido). Nunca se
// marca como seguro por falta de datos, y sodio y azúcar no entran: en la tarjeta serían un
// sello. El verde "Sin TACC" es solo el de Coto (label.tacc "SI", que en la lista casi nunca
// llega); el sello de Open Food Facts sale gris, "Sin TACC según OFF". Los dos, solo si
// taccStatus lo da por bueno. El límite de 2 corta desde el final.
export function cardTagItems(profile, label, n) {
  if (!profile) return [];
  const items = [];
  const mine = (profile.allergens ?? []).filter((key) => ALLERGENS[key]);
  const declared = n?.allergens ?? [];
  const traces = n?.traces ?? [];
  const tacc = profile.celiac ? taccStatus(label?.tacc ?? null, label?.name, n).kind : null;
  for (const key of mine) if (declared.includes(key)) items.push(["danger", `Tiene ${lcfirst(ALLERGENS[key])}`]);
  for (const key of mine) if (!declared.includes(key) && traces.includes(key)) items.push(["warn", `Puede tener ${lcfirst(ALLERGENS[key])}`]);
  if (tacc === "warn") items.push(["warn", "Revisá TACC"]);
  if (mine.length && !declared.length && !traces.length) items.push(["unknown", "Alergias: sin dato"]);
  if (tacc === "ok") items.push(label?.tacc === "SI" ? ["ok", "Sin TACC"] : ["unknown", "Sin TACC según OFF"]);
  return items.slice(0, 2).map(([kind, text]) => [kind, text, CARD_TAG_TITLE[text] ?? `${text}. Revisá el envase.`]);
}

function renderForYou(doc, items, ean, key) {
  const box = el(doc, "div", `${ROOT}-foryou`);
  box.dataset.ean = ean;
  box.dataset.profile = key;
  const ul = el(doc, "ul");
  for (const [kind, text] of items) ul.append(el(doc, "li", `${ROOT}-foryou-${kind}`, text));
  box.append(el(doc, "p", `${ROOT}-foryou-title`, "Para vos"), ul);
  return box;
}

// request(ean) → Promise<Nutrition | "missing" | "error">. onUpdate(): pedir un repintado.
// iconUrl: ícono de Open Food Facts (opcional). assetUrl(path): URL de un archivo de la
// extensión (íconos de alérgenos; opcional). skin(): true con la piel de la PDP prendida.
export function createNutritionUi(doc, { request, onUpdate, iconUrl = null, assetUrl = null, skin = () => false }) {
  const results = new Map(); // ean -> resultado
  const asked = new Set();
  let profile = null; // perfil personal del popup (o null)

  function ask(ean) {
    if (asked.has(ean)) return;
    asked.add(ean);
    let p;
    try {
      p = Promise.resolve(request(ean));
    } catch {
      p = Promise.resolve("error");
    }
    p.catch(() => "error")
      .then((r) => {
        results.set(ean, r ?? "error");
        onUpdate();
      });
  }

  // Nodos de Góndola ya dibujados: en la columna y en la sección.
  const ours = (container, section) => [
    ...container.querySelectorAll(`:scope > .${ROOT}, :scope > .${ROOT}-sum, :scope > .${ROOT}-badge, :scope > .${ROOT}-foryou`),
    ...(section ? section.host.querySelectorAll(`:scope > .${ROOT}-section`) : []),
  ];

  function place(node, parent, after) {
    if (after && after.parentElement === parent) after.after(node);
    else parent.append(node);
  }

  // Dibuja o borra según la etiqueta de este momento: una respuesta vieja nunca se dibuja
  // sobre otro producto. section: { host, after } (junto a la descripción) o null.
  // gallery: { thumbs, big } de la galería de Coto, o null.
  function paint(container, anchor, label, enabled, section = null, gallery = null) {
    const ean = enabled && label?.nutri && label.ean ? String(label.ean) : null;
    const r = ean ? results.get(ean) : undefined;
    const keep = ean && r !== undefined && r !== "error";
    paintGallery(doc, gallery, keep ? ean : null, keep ? r : null, iconUrl);
    for (const node of ours(container, section)) {
      // Otro producto, o cambió el modo (con sección / desplegable): se borra.
      const wrongMode = section ? node.classList.contains(ROOT) : !node.classList.contains(ROOT);
      if (!keep || node.dataset.ean !== ean || wrongMode) node.remove();
    }
    if (section) {
      if (section.host.querySelector(`:scope > .${ROOT}-section`)) section.host.setAttribute(HOST, "");
      else section.host.removeAttribute(HOST);
    }
    if (!ean) return;
    if (r === undefined) return ask(ean);
    if (!keep) return;
    // Bebida: cada 100 ml, salvo que Coto la venda por peso (polvos para preparar).
    const liquid = label.group === "L" || (label.drink === true && label.group !== "kg");
    const opts = { ean, liquid, iconUrl, label, assetUrl };
    if (!section) {
      if (!container.querySelector(`:scope > .${ROOT}`)) place(renderNutrition(doc, r, opts), container, anchor);
      return;
    }
    const status = taccStatus(label.tacc ?? null, label.name, r === "missing" ? null : r);
    const taccKey = `${status.kind}|${status.text}`;
    opts.taccKey = taccKey;
    opts.skin = Boolean(skin());
    // Se rehace si cambió el estado Sin TACC o si se prendió o apagó la piel.
    const oldSection = section.host.querySelector(`:scope > .${ROOT}-section`);
    if (oldSection && (oldSection.dataset.tacc !== taccKey || (oldSection.dataset.skin === "1") !== opts.skin)) oldSection.remove();
    if (!section.host.querySelector(`:scope > .${ROOT}-section`)) {
      place(renderSection(doc, r, opts), section.host, section.after);
      section.host.setAttribute(HOST, "");
    }
    if (r !== "missing" && !container.querySelector(`:scope > .${ROOT}-sum`)) {
      const sum = renderSummary(doc, r, opts);
      if (sum) place(sum, container, anchor);
    }
    // Marca Sin TACC en la columna: solo si Coto u OFF lo dicen (verde) o hay que revisar (ámbar).
    // Se rehace si cambió el estado.
    const oldBadge = container.querySelector(`:scope > .${ROOT}-badge`);
    if (oldBadge && oldBadge.dataset.tacc !== taccKey) oldBadge.remove();
    if ((status.kind === "ok" || status.kind === "warn") && !container.querySelector(`:scope > .${ROOT}-badge`)) {
      const badge = el(doc, "p", `${ROOT}-badge ${ROOT}-badge--${status.kind}`, status.text);
      badge.dataset.ean = ean;
      badge.dataset.tacc = taccKey;
      place(badge, container, container.querySelector(`:scope > .${ROOT}-sum`) ?? anchor);
    }
    // "Para vos": se rehace si cambió el perfil.
    const items = forYouItems(profile, label, r === "missing" ? null : r, liquid);
    const key = JSON.stringify(items);
    const current = container.querySelector(`:scope > .${ROOT}-foryou`);
    if (current && current.dataset.profile !== key) current.remove();
    if (items.length && !container.querySelector(`:scope > .${ROOT}-foryou`)) {
      const after = container.querySelector(`:scope > .${ROOT}-badge`) ?? container.querySelector(`:scope > .${ROOT}-sum`) ?? anchor;
      place(renderForYou(doc, items, ean, key), container, after);
    }
  }

  // Tarjetas de la lista: solo se pide con un perfil que lo necesita (celíaco o alguna alergia).
  const wantsCards = () => Boolean(profile && (profile.celiac || profile.allergens?.length));

  // Etiquetas de la tarjeta, o undefined si el dato de ese EAN todavía no llegó (no se muestra
  // nada antes de la respuesta). "missing" y "error" son lo mismo: sin tabla, n = null.
  function cardTags(label) {
    if (!label?.ean) return undefined;
    const r = results.get(String(label.ean));
    if (r === undefined) return undefined;
    return cardTagItems(profile, label, typeof r === "object" ? r : null);
  }

  return { paint, setProfile: (p) => (profile = p ?? null), wantsCards, cardTags, request: (ean) => ask(String(ean)) };
}
