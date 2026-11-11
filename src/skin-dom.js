// Mapa de selectores de la web de Coto para la piel de Góndola. Sale del HTML real
// guardado en tests/fixtures/dom/ (npm run fixtures:dom); tests/skin-dom.test.js lo
// comprueba contra esos archivos. Un valor null es una parte que Coto no tiene (o que no
// se pudo capturar), con el motivo en el comentario.
// Se prefieren las clases con nombre propio de Coto (.card-container, .plp-header__sort) y
// las etiquetas de sus componentes (product-add-show-remove). Se evitan las clases de
// utilidad (col-12, mt-4) y los atributos _ngcontent-*, que cambian con cada publicación.

export const DOM = {
  list: {
    // div.productos.row > div.producto-card (col-*) > constructor-result-item > .card-container
    grid: ".productos",
    cell: ".productos > .producto-card", // hay otro nodo más abajo: constructor-result-item (elemento propio, display inline)
    card: ".card-container",
    centro: ".centro-precios",
    buttons: ".bottom-botones",
    name: ".nombre-producto",
    addButton: ".bottom-botones product-add-show-remove .btn-primary",
    // Solo existe con sesión iniciada; no se pudo capturar (ver tests/skin-dom.test.js).
    // Es el campo que ya usan src/promo-clicks.js y src/pin-input.js.
    stepper: '.bottom-botones product-add-show-remove input[id^="input-prod"]',
    outOfStock: null, // ninguna de las categorías revisadas tenía un producto sin stock: sin captura
    cuotas: ".bottom-botones > a", // "Ver planes de cuotas"
    // Sin clase propia: es la última <small class="text-center"> de .centro-precios. Más seguro: por el texto "Precio sin impuestos nacionales".
    taxLine: ".centro-precios small.text-center:last-child",
    title: ".plp-header__title",
    sort: ".plp-header__sort",
    // Sin clase propia: es el .filter-block cuyo .filter-title dice "Categoría", y solo existe en categorías que tienen hijas (en una hoja el primer bloque es "Marca"). Se reconoce por el texto.
    subcats: null,
    filters: "#filtrosmenu", // columna izquierda: filtros y publicidad
    filterGroup: ".filter-block",
    filterTitle: ".filter-block > .filter-title",
    filterLink: ".filter-list > li > a", // sin el link "Más", que cuelga directo del <ul>
    // Segundo <ul> de "Su selección": un <li><a> por filtro aplicado (el link lo saca). El primer <ul> es la ruta de categorías. Solo existe con algún filtro puesto.
    applied: "app-breadcrumbs ul + ul",
    // Extras que usa el diseño de la cabecera:
    header: ".plp-header", // contiene .plp-header__heading (título y cantidad) y .plp-header__sort
    count: ".plp-header__count",
  },
  pdp: {
    // aside.row > [article.gallery-wrap, div.col-lg-6 (la columna de compra)]
    columns: "app-product-detail aside.row",
    gallery: "app-product-detail .gallery-wrap",
    thumbs: ".gallery-wrap .thumbs-wrap",
    big: ".gallery-wrap .img-big-wrap",
    // Un solo contenedor con el título, PLU/EAN, oferta, precio, cuotas y el botón. Sin clase propia: es el único <div> hijo directo de la fila de dos columnas.
    buy: "app-product-detail aside.row > div",
    // En la PDP el título es un h1.title; .titulo-producto es el del mini carrito, no de esta página.
    title: "app-product-detail aside.row h1.title",
    price: "app-product-detail .price",
    addButton: "app-product-detail aside.row product-add-show-remove .btn-primary",
    // Solo con sesión iniciada, como en la lista.
    stepper: 'app-product-detail aside.row product-add-show-remove input[id^="input-prod"]',
    cuotas: "app-product-detail aside.row a:has(> .form-check-label)", // "Ver planes de cuotas": el link de Coto envuelve a un span
    // "Instrucciones para armar el pedido" no está en la página sin sesión ni con el producto fuera del carrito; no se pudo capturar.
    noteForm: null,
    noteField: null,
    description: ".pdp-description",
    features: ".pdp-characteristics",
  },
};

// Sin estas claves la piel no se prende: la página queda como en la 0.12.0.
export const REQUIRED = {
  list: ["grid", "card", "centro", "buttons"],
  pdp: ["price", "buy"],
};
