// Una entrada "Configurar Góndola" en el menú de perfil de Coto (el que se abre con el
// botón de la persona, con sesión iniciada). Solo agrega un nodo: no toca los de Coto.
// El menú se reconoce por sus textos, porque Coto no le pone nombres fijos.

const MARK = "data-gondola-menu";
const ANCHOR = "Mis Listas";
const NEIGHBOURS = ["Mis Pedidos", "Horarios de entrega", "Cerrar sesión"];

// El elemento que tiene ese texto exacto, sin contar los nodos de Góndola.
function byText(doc, text) {
  const walker = doc.createTreeWalker(doc.body, 4 /* NodeFilter.SHOW_TEXT */);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (n.nodeValue.trim() === text && !n.parentElement.closest(`[${MARK}]`)) return n.parentElement;
  }
  return null;
}

// La fila del menú: el ancestro de "Mis Listas" que es hermano de la fila de otra opción.
function menuItem(doc) {
  const anchor = byText(doc, ANCHOR);
  if (!anchor) return null;
  for (const text of NEIGHBOURS) {
    const other = byText(doc, text);
    if (!other) continue;
    for (let item = anchor; item.parentElement; item = item.parentElement) {
      if (item.contains(other)) break;
      if (item.parentElement.contains(other)) return item;
    }
  }
  return null;
}

// Arma la fila con la misma forma que la de Coto (mismas etiquetas y clases), sin copiar sus nodos.
function build(doc, item, { iconUrl, onOpen }) {
  const link = item.matches("a, button") ? item : item.querySelector("a, button");
  const inner = doc.createElement(link && link !== item ? link.tagName : "span");
  if (link && link !== item) inner.className = link.className;
  const row = doc.createElement(item.tagName);
  row.className = item.className;
  row.setAttribute(MARK, "");
  const target = link === item ? row : inner;
  if (target.tagName === "A") target.setAttribute("href", "#");
  if (target.tagName === "BUTTON") target.type = "button";
  if (target.tagName !== "A" && target.tagName !== "BUTTON") { target.setAttribute("role", "button"); target.tabIndex = 0; }
  target.classList.add("gondola-menu-link");
  const img = doc.createElement("img");
  img.className = "gondola-menu-icon";
  img.src = iconUrl;
  img.alt = "";
  img.width = 18;
  img.height = 18;
  const label = doc.createElement("span");
  label.textContent = "Configurar Góndola";
  target.append(img, label);
  if (target !== row) row.append(inner);
  const open = (e) => { e.preventDefault(); e.stopPropagation(); onOpen(); };
  target.addEventListener("click", open);
  target.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") open(e); });
  return row;
}

// Agrega la entrada si el menú está y todavía no la tiene. Devuelve true si la agregó.
export function addMenuEntry(doc, opts) {
  if (!doc.body) return false;
  const item = menuItem(doc);
  if (!item || item.parentElement.querySelector(`:scope > [${MARK}]`)) return false;
  item.after(build(doc, item, opts));
  return true;
}

// El menú aparece al tocar o pasar por el botón de perfil: se mira después de cada gesto.
export function installCotoMenu(win, doc, opts) {
  let timer = null;
  const check = () => {
    if (timer) return;
    timer = win.setTimeout(() => { timer = null; addMenuEntry(doc, opts); }, 150);
  };
  for (const type of ["click", "focusin", "mouseover"]) doc.addEventListener(type, check, true);
  return { check };
}
