// Pantalla de bienvenida: se abre una vez, al instalar. Explica qué hace Góndola y cómo
// dejarla a gusto. A la derecha va el menú real de la extensión, para usarlo ahí mismo.

const SVG = "http://www.w3.org/2000/svg";

const STEPS = [
  { title: "Abrí Coto", text: "Entrá a coto.com.ar una vez. Así Góndola carga las promos de los bancos.", action: true },
  { title: "Elegí tus tarjetas", text: "En Tarjetas, marcá las promos de tus bancos y el día de compra. Vas a ver el precio con tu descuento, si Coto lo aplica a ese producto." },
  { title: "Prendé o apagá lo que quieras", text: "En Ajustes, cada función tiene su interruptor: el diseño nuevo, los avisos de promos, la comparación con otros súper y la información nutricional." },
  { title: "Cargá tu perfil, si querés", text: "En Ajustes, Mi perfil: celiaquía, sodio, azúcar y alergias. Queda solo en tu navegador. No es consejo médico." },
];

const FEATURES = [
  { title: "Diseño más claro", text: "La lista y la página de producto, ordenadas y con todo a la misma altura. Se apaga cuando quieras.", icon: ["M4 5h16v14H4z", "M4 10h16", "M10 10v9"] },
  { title: "Precio real por kilo", text: "El precio por kilo o litro con la oferta, y una opción nueva en \"Ordenar por\".", icon: ["M4 4h7l9 9l-7 7l-9-9z", "M8.5 8.5v.1"] },
  { title: "Tu banco", text: "El precio con la promo de tu tarjeta, o por qué no aplica.", icon: ["M3 8a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3z", "M3 10h18", "M7 15h4"] },
  { title: "Otros súper", text: "El mismo producto, por código de barras, en Carrefour, Día y Más.", icon: ["M4 9l1.5-5h13L20 9", "M4 9v11h16V9", "M10 20v-5h4v5"] },
  { title: "Información nutricional", text: "La tabla de Open Food Facts, Sin TACC, alérgenos e ingredientes.", icon: ["M12 21c-4 0-7-3-7-7c0-5 4-9 7-11c3 2 7 6 7 11c0 4-3 7-7 7z", "M12 21v-9"] },
  { title: "Carrito real", text: "Subtotal, descuentos y reintegro del banco con su tope.", icon: ["M4 5h2l2 11h10l2-8H7", "M9 20v.1", "M17 20v.1"] },
];

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

// meta: { version, popupUrl, cotoUrl, privacyUrl, repoUrl }
export function renderWelcome(doc, meta = {}) {
  const coto = meta.cotoUrl ?? "https://www.coto.com.ar/";
  const steps = el(doc, "ol", { className: "steps" }, STEPS.map((s) => el(doc, "li", {}, [
    el(doc, "h3", { textContent: s.title }),
    el(doc, "p", { textContent: s.text }),
    s.action ? el(doc, "a", { className: "button", href: coto, target: "_blank", rel: "noopener noreferrer", textContent: "Abrir Coto" }) : null,
  ])));

  const features = el(doc, "ul", { className: "features" }, FEATURES.map((f) => el(doc, "li", {}, [
    el(doc, "span", { className: "feature-icon" }, [icon(doc, f.icon)]),
    el(doc, "div", {}, [el(doc, "h3", { textContent: f.title }), el(doc, "p", { textContent: f.text })]),
  ])));

  const menu = meta.popupUrl
    ? el(doc, "figure", { className: "menu-live" }, [
      el(doc, "iframe", { src: meta.popupUrl, title: "Menú de Góndola", attrs: { width: "360", height: "580" } }),
      el(doc, "figcaption", { textContent: "Este es el menú de Góndola. Podés usarlo acá mismo." }),
    ])
    : null;

  doc.body.replaceChildren(
    el(doc, "header", { className: "brand" }, [
      el(doc, "img", { src: "assets/icon/icon.svg", alt: "", attrs: { width: "40", height: "40" } }),
      el(doc, "span", { textContent: "Góndola" }),
    ]),
    el(doc, "main", {}, [
      el(doc, "section", { className: "hero" }, [
        el(doc, "div", { className: "hero-text" }, [
          el(doc, "h1", { textContent: "Góndola ya está en tu Chrome" }),
          el(doc, "p", { className: "lead", textContent: "Mejora la web de Coto mientras comprás. No tenés que hacer nada para que funcione. En un minuto la dejás a tu gusto." }),
          el(doc, "h2", { textContent: "Cómo dejarla a tu gusto" }),
          steps,
          el(doc, "p", { className: "tip" }, [
            el(doc, "strong", { textContent: "Para tenerla a mano: " }),
            "tocá la pieza de rompecabezas de Chrome, arriba a la derecha, y fijá Góndola. Con sesión iniciada en Coto, también está en el menú de tu perfil: \"Configurar Góndola\".",
          ]),
        ]),
        menu,
      ]),
      el(doc, "section", { className: "found" }, [el(doc, "h2", { textContent: "Qué vas a encontrar en Coto" }), features]),
    ]),
    el(doc, "footer", {}, [
      el(doc, "p", {}, [
        "Góndola no tiene servidores ni junta datos personales. Tus ajustes quedan en tu navegador. ",
        meta.privacyUrl ? el(doc, "a", { href: meta.privacyUrl, target: "_blank", rel: "noopener noreferrer", textContent: "Política de privacidad" }) : null,
        meta.repoUrl ? " · " : null,
        meta.repoUrl ? el(doc, "a", { href: meta.repoUrl, target: "_blank", rel: "noopener noreferrer", textContent: "Código abierto" }) : null,
      ]),
      el(doc, "p", { textContent: `Podés volver a esta página desde Ayuda, en el menú de Góndola. No afiliada a Coto. Versión ${meta.version ?? ""}`.trim() }),
    ]),
  );
}
