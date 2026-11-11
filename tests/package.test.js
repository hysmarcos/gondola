import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { manifestRefs, packageFiles, missingRefs } from "../scripts/package-lib.mjs";

const manifest = JSON.parse(readFileSync("manifest.json", "utf8"));
const popup = readFileSync("popup.html", "utf8");

// Archivos del repo, como los vería el script (sin node_modules).
const REPO = [
  "manifest.json", "popup.html", "LICENSE", "README.md", "package.json", "build.mjs",
  "dist/interceptor.js", "dist/badge.js", "dist/popup.js", "dist/background.js",
  "src/badge.css", "src/skin.css", "src/skin-list.css", "src/popup.css", "src/popup.js", "src/badge.js",
  "assets/icon/icon.svg", "assets/icon/icon-16.svg", "assets/icon/icon-16.png", "assets/icon/icon-32.png", "assets/icon/icon-48.png", "assets/icon/icon-128.png",
  "assets/banks/logo_icbc_1.png", "assets/banks/logo_galicia.png",
  "assets/off/off-logo-icon-light.svg",
  "assets/allergens/milk.png",
  "assets/fonts/OFL.txt", "assets/fonts/poppins-latin-400-normal.woff2",
  "tests/package.test.js", "scripts/dev-server.mjs", "dist-dev/demo.min.js", "docs/img/readme/gondola-demo.gif", "site/index.html",
];

describe("paquete para la Chrome Web Store", () => {
  it("lee todo lo que el manifest y el popup usan", () => {
    const refs = manifestRefs(manifest, popup);
    expect(refs).toEqual(expect.arrayContaining([
      "dist/background.js", "dist/interceptor.js", "dist/badge.js", "src/badge.css", "popup.html",
      "assets/icon/icon-16.png", "assets/icon/icon-128.png", "assets/banks/*", "src/popup.css", "dist/popup.js",
    ]));
  });

  it("lleva solo lo que la extensión usa: nada de código fuente, tests ni herramientas", () => {
    const files = packageFiles(REPO);
    expect(files).toEqual(expect.arrayContaining([
      "manifest.json", "popup.html", "LICENSE", "dist/badge.js", "dist/popup.js", "src/badge.css", "src/skin.css", "src/popup.css",
      "assets/icon/icon.svg", "assets/icon/icon-128.png", "assets/banks/logo_icbc_1.png", "assets/fonts/poppins-latin-400-normal.woff2",
      "assets/off/off-logo-icon-light.svg", "assets/allergens/milk.png",
    ]));
    for (const f of ["src/popup.js", "src/badge.js", "tests/package.test.js", "scripts/dev-server.mjs", "dist-dev/demo.min.js", "docs/img/readme/gondola-demo.gif", "site/index.html", "package.json", "README.md", "assets/icon/icon-16.svg"]) {
      expect(files).not.toContain(f);
    }
  });

  it("avisa si falta un archivo que pide el manifest", () => {
    const refs = manifestRefs(manifest, popup);
    expect(missingRefs(refs, packageFiles(REPO))).toEqual([]);
    expect(missingRefs(refs, packageFiles(REPO.filter((f) => f !== "dist/badge.js")))).toEqual(["dist/badge.js"]);
    expect(missingRefs(refs, packageFiles(REPO.filter((f) => !f.startsWith("assets/banks/"))))).toEqual(["assets/banks/*"]);
  });
});
