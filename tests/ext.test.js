import { describe, it, expect } from "vitest";
import { createExt } from "../src/ext.js";

const dead = () => { throw new Error("Extension context invalidated."); };

describe("createExt", () => {
  it("con la extensión viva, pasa las llamadas tal cual", async () => {
    const ext = createExt({ runtime: { getURL: (p) => "chrome-extension://abc/" + p, sendMessage: async (m) => ({ got: m }) } });
    expect(ext.getURL("assets/x.png")).toBe("chrome-extension://abc/assets/x.png");
    await expect(ext.send({ type: "compare" })).resolves.toEqual({ got: { type: "compare" } });
  });

  it("con la extensión recargada, getURL devuelve null en lugar de tirar", () => {
    const ext = createExt({ runtime: { getURL: dead, sendMessage: dead } });
    expect(ext.getURL("assets/x.png")).toBe(null);
  });

  it("con la extensión recargada, send rechaza la promesa en lugar de tirar", async () => {
    const ext = createExt({ runtime: { getURL: dead, sendMessage: dead } });
    let p;
    expect(() => { p = ext.send({ type: "compare" }); }).not.toThrow();
    await expect(p).rejects.toThrow("Extension context invalidated");
  });

  it("si runtime ya no existe, tampoco tira", async () => {
    const ext = createExt({});
    expect(ext.getURL("a")).toBe(null);
    await expect(ext.send({})).rejects.toBeTruthy();
  });
});
