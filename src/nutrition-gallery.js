// Fotos de Open Food Facts en la galería del producto de Coto: miniaturas propias al final
// de las de Coto y un visor encima de la foto grande. No toca las fotos de Coto.

const THUMB = "coto-unit-offthumb";
const VIEW = "coto-unit-offview";
const WIRED = "data-coto-unit-offgallery";

const KINDS = [
  ["front", "frente"],
  ["nutrition", "tabla nutricional"],
  ["ingredients", "ingredientes"],
];

// Fotos que existen, en orden. full: la foto en tamaño completo (".full.jpg").
export function photoList(photos) {
  return KINDS.filter(([kind]) => photos?.[kind]).map(([kind, label]) => {
    const thumb = photos[kind];
    return { kind, label, thumb, full: /\.400\.jpg$/.test(thumb) ? thumb.replace(/\.400\.jpg$/, ".full.jpg") : thumb };
  });
}

function img(doc, className, src, alt) {
  const i = doc.createElement("img");
  i.className = className;
  i.src = src;
  i.alt = alt;
  return i;
}

function closeView(gallery) {
  gallery.big?.querySelector(`:scope > .${VIEW}`)?.remove();
  for (const t of gallery.thumbs.querySelectorAll(`.${THUMB}--active`)) t.classList.remove(`${THUMB}--active`);
}

function openView(doc, gallery, photo, url, iconUrl, thumb) {
  closeView(gallery);
  thumb.classList.add(`${THUMB}--active`);
  if (!gallery.big) return;
  const view = doc.createElement("div");
  view.className = VIEW;
  view.append(img(doc, `${VIEW}-photo`, photo.full, `Foto de Open Food Facts: ${photo.label}`));
  const note = doc.createElement("p");
  note.className = `${VIEW}-note`;
  if (iconUrl) note.append(img(doc, `${VIEW}-icon`, iconUrl, ""));
  note.append("Foto de Open Food Facts, cargada por la comunidad. No es una foto de Coto. ");
  const a = doc.createElement("a");
  a.href = url;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  a.textContent = "Ver en Open Food Facts";
  note.append(a);
  view.append(note);
  gallery.big.append(view);
}

// gallery: { thumbs, big } de la página, o null. result: Nutrition, "missing" o null.
// Dibuja o borra según el producto de este momento.
export function paintGallery(doc, gallery, ean, result, iconUrl) {
  if (!gallery?.thumbs) return;
  const photos = ean && result && typeof result === "object" ? photoList(result.photos) : [];
  const current = [...gallery.thumbs.querySelectorAll(`:scope > .${THUMB}`)];
  if (current.length && current.every((t) => t.dataset.ean === ean) && current.length === photos.length) return;
  for (const t of current) t.remove();
  closeView(gallery);
  if (!photos.length) return;

  // Un clic en una miniatura de Coto vuelve a su foto.
  if (!gallery.thumbs.hasAttribute(WIRED)) {
    gallery.thumbs.setAttribute(WIRED, "");
    gallery.thumbs.addEventListener("click", (e) => {
      const thumb = e.target.closest?.(".item-thumb");
      if (thumb && !thumb.classList.contains(THUMB)) closeView(gallery);
    });
  }

  for (const photo of photos) {
    const t = doc.createElement("div");
    t.className = `item-thumb cursor-pointer ${THUMB}`;
    t.dataset.ean = ean;
    t.dataset.kind = photo.kind;
    const pic = img(doc, `${THUMB}-photo`, photo.thumb, `Foto de Open Food Facts: ${photo.label}`);
    pic.width = 60;
    pic.height = 60;
    t.append(pic);
    if (iconUrl) t.append(img(doc, `${THUMB}-badge`, iconUrl, ""));
    t.addEventListener("click", () => openView(doc, gallery, photo, result.url, iconUrl, t));
    gallery.thumbs.append(t);
  }
}
