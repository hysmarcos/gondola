// Qué va en el ZIP de la Chrome Web Store. Funciones puras: el script package.mjs lee el disco.

// Lo que la extensión carga en Chrome. Todo lo demás (código fuente, tests, docs,
// herramientas) queda afuera.
const INCLUDE = [
  /^manifest\.json$/,
  /^popup\.html$/,
  /^welcome\.html$/,
  /^LICENSE$/,
  /^dist\/[\w-]+\.js$/,
  /^src\/[\w-]+\.css$/,
  /^assets\/icon\/icon(-\d+)?\.png$/,
  /^assets\/icon\/icon\.svg$/,
  /^assets\/banks\/[\w.-]+\.png$/,
  /^assets\/fonts\/[\w.-]+\.(woff2|txt)$/,
  /^assets\/off\/[\w.-]+\.svg$/,
  /^assets\/stores\/[\w.-]+\.(png|svg)$/,
  /^assets\/allergens\/[\w.-]+\.png$/,
];

export function packageFiles(all) {
  return all.filter((f) => INCLUDE.some((re) => re.test(f))).sort();
}

// Rutas que pide el manifest (scripts, estilos, íconos, recursos) y las que carga el popup.
export function manifestRefs(manifest, popupHtml = "") {
  const refs = new Set();
  const add = (p) => p && refs.add(String(p).replace(/^\//, ""));
  add(manifest.background?.service_worker);
  add(manifest.action?.default_popup);
  Object.values(manifest.icons ?? {}).forEach(add);
  Object.values(manifest.action?.default_icon ?? {}).forEach(add);
  for (const cs of manifest.content_scripts ?? []) [...(cs.js ?? []), ...(cs.css ?? [])].forEach(add);
  for (const w of manifest.web_accessible_resources ?? []) (w.resources ?? []).forEach(add);
  for (const m of popupHtml.matchAll(/(?:src|href)="([^"#?]+)"/g)) if (!/^[a-z]+:/i.test(m[1])) add(m[1]);
  return [...refs].sort();
}

// Las rutas pedidas que no están en el paquete. "carpeta/*" pide al menos un archivo.
export function missingRefs(refs, files) {
  const have = new Set(files);
  return refs.filter((r) => (r.endsWith("/*") ? !files.some((f) => f.startsWith(r.slice(0, -1))) : !have.has(r)));
}
