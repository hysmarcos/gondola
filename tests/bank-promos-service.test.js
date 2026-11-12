import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { createBankPromosService, SOURCES, MAS_PROMOS_URL, MAS_BANKS_URL } from "../src/bank-promos/service.js";
import { createPriceCache } from "../src/price-cache.js";
import { STORES } from "../src/stores.js";

const NOW = Date.parse("2026-11-11T15:00:00Z");
const DAY = 86_400_000;

function memoryStorage() {
  const data = {};
  return { data, get: async (keys) => Object.fromEntries(keys.filter((k) => k in data).map((k) => [k, data[k]])), set: async (o) => Object.assign(data, o) };
}

const promo = (o) => ({ id: "1", store: "mas", bankLabel: "Modo", title: "x", percent: 20, cap: null, capKnown: true, online: true, from: null, to: null, legal: "", ...o });
const okRes = (body) => ({ ok: true, json: async () => body, text: async () => body });

function setup({ fetch = vi.fn(async () => okRes({})), parsers, now = () => NOW } = {}) {
  const storage = memoryStorage();
  const cache = createPriceCache(storage, now, { key: "bankPromosCache", ttlMs: DAY, max: 10 });
  const service = createBankPromosService({ fetch, cache, now, parsers, stores: STORES });
  return { service, fetch, storage };
}

describe("createBankPromosService", () => {
  it("baja una vez y usa la memoria durante 24 h", async () => {
    let t = NOW;
    const parsers = { mas: async (get) => (await get("https://x/promos", "json"), [promo()]) };
    const { service, fetch, storage } = setup({ parsers, now: () => t });
    expect(await service.get(["mas"])).toEqual({ mas: [promo()] });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][1]).toMatchObject({ credentials: "omit" });
    expect(fetch.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
    t += DAY - 1;
    expect(await service.get(["mas"])).toEqual({ mas: [promo()] });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(Object.keys(storage.data.bankPromosCache)).toEqual(["mas"]);
    t += 2;
    await service.get(["mas"]);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("devuelve solo promos online y dentro de fecha", async () => {
    const list = [
      promo({ id: "on" }),
      promo({ id: "off", online: false }),
      promo({ id: "vencida", to: "2026-11-10T00:00:00+00:00" }),
      promo({ id: "futura", from: "2026-11-12T00:00:00+00:00" }),
      promo({ id: "hoy", from: "2026-11-11T00:00:00+00:00", to: "2026-11-12T00:00:00+00:00" }),
      promo({ id: "rota", to: "mañana" }),
    ];
    const { service } = setup({ parsers: { mas: async () => list } });
    expect((await service.get(["mas"])).mas.map((p) => p.id)).toEqual(["on", "hoy"]);
  });

  it("guarda todo lo parseado y filtra al leer: una promo vence aunque esté en memoria", async () => {
    let t = NOW;
    const { service, fetch } = setup({ parsers: { mas: async (get) => (await get("u", "json"), [promo({ to: "2026-11-11T20:00:00Z" })]) }, now: () => t });
    expect((await service.get(["mas"])).mas).toHaveLength(1);
    t = Date.parse("2026-11-11T21:00:00Z");
    expect((await service.get(["mas"])).mas).toHaveLength(0);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("si el pedido falla da error, no se guarda y la próxima vez vuelve a pedir", async () => {
    const fetch = vi.fn(async () => ({ ok: false, status: 500 }));
    const { service, storage } = setup({ fetch, parsers: { mas: async (get) => (await get("u", "json"), [promo()]) } });
    expect(await service.get(["mas"])).toEqual({ mas: "error" });
    expect(storage.data.bankPromosCache).toBeUndefined();
    await service.get(["mas"]);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("un pedido que lanza también da error", async () => {
    const fetch = vi.fn(async () => {
      throw new Error("red");
    });
    const { service } = setup({ fetch, parsers: { mas: async (get) => get("u", "json") } });
    expect(await service.get(["mas"])).toEqual({ mas: "error" });
  });

  it("un parser que devuelve null da error y no se guarda", async () => {
    const { service, storage } = setup({ parsers: { carrefour: async () => null } });
    expect(await service.get(["carrefour"])).toEqual({ carrefour: "error" });
    expect(storage.data.bankPromosCache).toBeUndefined();
  });

  it("solo consulta los súper pedidos y conocidos", async () => {
    const mas = vi.fn(async () => [promo()]);
    const dia = vi.fn(async () => [promo({ store: "dia" })]);
    const { service } = setup({ parsers: { mas, dia } });
    expect(Object.keys(await service.get(["dia", "otro"]))).toEqual(["dia"]);
    expect(mas).not.toHaveBeenCalled();
    expect(await service.get(undefined)).toEqual({});
  });
});

describe("SOURCES", () => {
  const masFixture = JSON.parse(readFileSync("tests/fixtures/bank-mas.json", "utf8"));

  it("Más pide promos y bancos a las dos URL de la captura", async () => {
    const fetch = vi.fn(async (url) => okRes(url === MAS_PROMOS_URL ? masFixture.promos : masFixture.banks));
    const { service } = setup({ fetch, parsers: SOURCES, now: () => Date.parse("2026-11-11T12:00:00Z") });
    const { mas } = await service.get(["mas"]);
    expect(fetch.mock.calls.map((c) => c[0]).sort()).toEqual([MAS_BANKS_URL, MAS_PROMOS_URL].sort());
    expect(MAS_PROMOS_URL).toMatch(/^https:\/\/www\.masonline\.com\.ar\/_v\/private\/gdn-services\/content\/banks-promotions\?_fields=id,title,/);
    expect(MAS_BANKS_URL).toBe("https://www.masonline.com.ar/_v/private/gdn-services/content/financing-banks?_fields=id,name&_from=0&_to=99");
    expect(mas.map((p) => p.bankLabel)).toEqual(["Modo"]);
  });

  it("Día pide su página de promos", async () => {
    const html = readFileSync("tests/fixtures/bank-dia.html", "utf8");
    const fetch = vi.fn(async () => okRes(html));
    const { service } = setup({ fetch, parsers: SOURCES });
    const { dia } = await service.get(["dia"]);
    expect(fetch.mock.calls.map((c) => c[0])).toEqual([STORES.find((s) => s.id === "dia").promosUrl]);
    expect(dia.length).toBe(12);
  });

  it("Carrefour no se puede leer: error sin pedir la página", async () => {
    const { service, fetch } = setup({ parsers: SOURCES });
    expect(await service.get(["carrefour"])).toEqual({ carrefour: "error" });
    expect(fetch).not.toHaveBeenCalled();
  });
});
