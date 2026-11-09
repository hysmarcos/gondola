// Links para colaborar: abren los formularios de issues de GitHub.
// Solo mandan la versión de Góndola. Nada de la cuenta, el carrito ni la página.
export const REPO = "https://github.com/hysmarcos/gondola";

export function issueUrl(template, version) {
  const u = new URL(`${REPO}/issues/new`);
  u.searchParams.set("template", template);
  if (version) u.searchParams.set("version", version);
  return u.href;
}

// Ideas abiertas, primero las que tienen más 👍.
export const VOTE_URL = `${REPO}/issues?q=${encodeURIComponent("is:open label:mejora sort:reactions-+1-desc")}`;

export function feedbackLinks(version) {
  return [
    { id: "error", title: "Reportar un error", text: "Algo se ve mal, no anda o un precio no cierra.", href: issueUrl("reportar-error.yml", version), icon: ["M12 21a9 9 0 1 0 0-18a9 9 0 0 0 0 18z", "M12 8v4.5", "M12 16h.01"] },
    { id: "mejora", title: "Proponer una mejora", text: "Una función nueva o un cambio de diseño.", href: issueUrl("proponer-mejora.yml", version), icon: ["M9 18h6", "M10 21h4", "M12 3a6 6 0 0 0-3.6 10.8c.6.5.9 1.1.9 1.9V16h5.4v-.3c0-.8.3-1.4.9-1.9A6 6 0 0 0 12 3z"] },
    { id: "super", title: "Pedir otro súper", text: "¿Querés Góndola en Carrefour, Día, Jumbo u otro?", href: issueUrl("pedir-super.yml", version), icon: ["M3 9l1.5-5h15L21 9", "M4 9v11h16V9", "M3 9h18", "M10 20v-5h4v5"] },
    { id: "votar", title: "Votar ideas", text: "Sumá 👍 a las ideas que querés primero.", href: VOTE_URL, icon: ["M7 10v11", "M15 5.9L14 10h5.8a2 2 0 0 1 1.9 2.6l-2.3 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.8a2 2 0 0 0 1.8-1.1L12 2a3.1 3.1 0 0 1 3 3.9z"] },
  ];
}
