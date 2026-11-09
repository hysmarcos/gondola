import { build } from "esbuild";

const common = { bundle: true, format: "iife", target: "chrome120", logLevel: "info" };

await build({ ...common, entryPoints: ["src/main.js"], outfile: "dist/interceptor.js" });
await build({ ...common, entryPoints: ["src/badge-entry.js"], outfile: "dist/badge.js" });
