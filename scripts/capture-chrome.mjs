// Guarda el HTML real del encabezado, el pie, el inicio y la página de ingreso de Coto en
// tests/fixtures/dom/. Con eso se escriben y prueban los selectores del modo oscuro
// (src/theme.css). Hermano de capture-dom.mjs: mismo método, otras páginas.
// Sin la extensión cargada y sin sesión: contexto nuevo de Playwright, sin cookies, sin
// perfil de Chrome, sin iniciar sesión ni escribir nada en el sitio.
// Uso: npm run fixtures:chrome
//   Coto bloquea el Chrome sin ventana ("no pudimos completar tu solicitud"), así que abre
//   Chrome visible: no tocar la ventana mientras corre. CHROME_PATH=ruta a Chrome si
//   Playwright no encuentra el instalado.
//   Si el encabezado muestra a una persona ("Hola" con un nombre, "Envío a" con una
//   dirección, un correo) o no muestra "Ingresar", el script falla y no escribe nada.
//   El carrito no se puede capturar sin sesión (/carrito redirige a /ingresar), y iniciar sesión
//   está fuera de este script: se revisa a mano. En su lugar se guarda ingresar.html (login y
//   registro). Si /ingresar deja de ser esa página (otra URL final), el script falla y no escribe.
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";

const BASE = "https://www.coto.com.ar";
const OUT = "tests/fixtures/dom";
const MAX_CARDS = 8;
const VIEW = { width: 1280, height: 860 };

// Partes de la página que no hacen falta para los selectores o que pueden traer datos de la persona.
// Sin app-header ni footer-section: esos se guardan aparte, y el inicio y la página de ingreso van sin ellos.
const DROP = "script, style, noscript, iframe, link, template, app-header, footer-section, app-chat-agent, ngx-spinner, .grecaptcha-badge, #a11y-status-message";

// Datos de una persona en el encabezado: saludo, dirección de envío o correo.
const PERSONAL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+|\bHola\b|Env[ií]o a|Mi cuenta/i;

async function open(page, url, ready) {
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(ready, { timeout: 45000 });
  await page.waitForTimeout(4000);
}

// Devuelve el outerHTML limpio de un selector (el elemento entero) o del body, sin imágenes
// ni comentarios. Se conserva el src de las imágenes que son logos o íconos (clase o ruta con
// "logo" o "icon", o .svg), porque el modo oscuro decide qué hacer según su color; las fotos
// de producto y los banners pierden el src. trim: en el inicio, de cada grupo de hermanos que
// son tarjetas o diapositivas se conservan hasta MAX_CARDS, y de los paneles de días de las
// promos, dos.
function snapshot(page, selector, { trim = false } = {}) {
  return page.evaluate(({ selector, drop, trim, max }) => {
    const root = document.querySelector(selector).cloneNode(true);
    root.querySelectorAll(drop).forEach((n) => n.remove());
    const keep = (img) => {
      const src = img.getAttribute("src") || "";
      const hint = (img.getAttribute("class") || "") + " " + src;
      return src && src.length < 1500 && (/logo|icon/i.test(hint) || /\.svg(\?|$)/i.test(src));
    };
    for (const img of root.querySelectorAll("img, source")) {
      const kept = img.tagName === "IMG" && keep(img);
      for (const a of ["src", "srcset", "data-src", "data-srcset"]) {
        if (!(kept && a === "src")) img.removeAttribute(a);
      }
    }
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_COMMENT);
    const comments = [];
    while (walker.nextNode()) comments.push(walker.currentNode);
    comments.forEach((c) => c.remove());
    if (trim) {
      for (const parent of root.querySelectorAll("*")) {
        const groups = new Map();
        for (const kid of parent.children) {
          // La tarjeta puede ser el hijo o venir envuelta en un div sin clase propia. Se agrupa
          // por etiqueta: las diapositivas cambian de clase (swiper-slide-next, -active...).
          if (!/card|slide|item/i.test(kid.tagName + " " + kid.className + " " + (kid.firstElementChild?.className ?? ""))) continue;
          const key = kid.tagName;
          if (!groups.has(key)) groups.set(key, []);
          groups.get(key).push(kid);
        }
        for (const kids of groups.values()) kids.slice(max).forEach((k) => k.remove());
      }
    }
    if (trim) {
      // Los paneles de días de las promos repiten el mismo marcado: bastan dos.
      root.querySelectorAll(".tab-content").forEach((t) => [...t.querySelectorAll(":scope > .tab-pane")].slice(2).forEach((n) => n.remove()));
    }
    return root.outerHTML;
  }, { selector, drop: selector === "body" ? DROP : "script, style, noscript, iframe, link, template", trim, max: MAX_CARDS });
}

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ channel: process.env.CHROME_PATH ? undefined : "chrome", executablePath: process.env.CHROME_PATH || undefined, headless: false });
// Contexto nuevo: sin cookies, sin storage, sin sesión.
const context = await browser.newContext({ viewport: VIEW, locale: "es-AR" });
const page = await context.newPage();

// Inicio
await open(page, `${BASE}/`, "app-header header-category li.categoria-producto");
await page.waitForSelector("footer-section", { timeout: 15000 }).catch(() => {});

// Guarda: nada se escribe si el encabezado trae a una persona.
const headerText = await page.locator("app-header").first().innerText();
const hit = headerText.match(PERSONAL);
if (hit || !/Ingresar/.test(headerText)) {
  await browser.close();
  console.error(hit
    ? `El encabezado muestra datos de una persona ("${hit[0]}"). No se guardó nada.`
    : "El encabezado no muestra \"Ingresar\": no se puede confirmar que no haya sesión. No se guardó nada.");
  process.exit(1);
}

const footerHtml = await snapshot(page, "footer-section");
const homeHtml = await snapshot(page, "body", { trim: true });

// Encabezado, con el menú de categorías abierto con un clic en la primera categoría.
const first = page.locator("app-header li.categoria-producto > a").first();
await first.click();
await page.waitForTimeout(1500);
const headerHtml = await snapshot(page, "app-header");
const headerAfter = await page.locator("app-header").first().innerText();
const menuOpened = headerHtml.length > 0 && (await page.locator("app-header").first().innerText()).length > headerText.length;
if (PERSONAL.test(headerAfter) || PERSONAL.test(headerHtml)) {
  await browser.close();
  console.error("El encabezado guardado trae datos de una persona. No se guardó nada.");
  process.exit(1);
}

// Página de ingreso (a donde redirige /carrito sin sesión)
await open(page, `${BASE}/ingresar`, "app-header");
const loginUrl = page.url();
if (new URL(loginUrl).pathname !== "/ingresar" || !(await page.locator("login-main form").count())) {
  await browser.close();
  console.error(`${loginUrl} no es la página de ingreso (login-main con formulario). No se guardó nada.`);
  process.exit(1);
}
const loginHtml = await snapshot(page, "body");
await browser.close();

await writeFile(`${OUT}/header.html`, headerHtml);
await writeFile(`${OUT}/footer.html`, footerHtml);
await writeFile(`${OUT}/home.html`, homeHtml);
await writeFile(`${OUT}/ingresar.html`, loginHtml);

const kb = (s) => (Buffer.byteLength(s) / 1024).toFixed(1) + " KB";
console.log(JSON.stringify({ ingresarUrl: loginUrl, header: kb(headerHtml), footer: kb(footerHtml), home: kb(homeHtml), ingresar: kb(loginHtml), menuAbierto: menuOpened }));
