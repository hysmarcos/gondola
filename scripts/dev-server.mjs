// Servidor local para inyectar dist/ y dist-dev/ en coto.com.ar durante el desarrollo.
import { createServer } from "node:http";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();
createServer(async (req, res) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Private-Network": "true",
    "Access-Control-Allow-Headers": "*",
    "Cache-Control": "no-store",
  };
  if (req.method === "OPTIONS") return res.writeHead(204, headers).end();
  if (req.method === "POST" && req.url === "/save") {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    await writeFile(join(root, "dist-dev", "catalog.json"), Buffer.concat(chunks));
    return res.writeHead(200, headers).end("ok");
  }
  const path = decodeURIComponent(new URL(req.url, "http://x").pathname).replace(/^\/+/, "");
  if (path.includes("..") || !/^(dist|dist-dev|src)\//.test(path)) return res.writeHead(404, headers).end();
  try {
    const body = await readFile(join(root, path));
    const type = path.endsWith(".css") ? "text/css" : path.endsWith(".html") ? "text/html; charset=utf-8" : path.endsWith(".json") ? "application/json" : "text/javascript";
    res.writeHead(200, { ...headers, "Content-Type": type }).end(body);
  } catch {
    res.writeHead(404, headers).end();
  }
}).listen(8765, "127.0.0.1", () => console.log("dev server on http://127.0.0.1:8765"));
