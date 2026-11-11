import { build } from "esbuild";

const common = { bundle: true, format: "iife", target: "chrome120", logLevel: "info" };

await build({ ...common, entryPoints: ["src/main.js"], outfile: "dist/interceptor.js" });
await build({ ...common, entryPoints: ["src/badge-entry.js"], outfile: "dist/badge.js" });
await build({ ...common, entryPoints: ["src/popup-entry.js"], outfile: "dist/popup.js" });
await build({ ...common, entryPoints: ["src/background.js"], outfile: "dist/background.js" });
await build({ ...common, entryPoints: ["src/welcome-entry.js"], outfile: "dist/welcome.js" });
