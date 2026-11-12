import { describe, it, expect, vi } from "vitest";
import { createCompareClient } from "../src/compare-client.js";

const offer = { unit: 1200, qty: 1, promo: null };

// Timer manual: guarda los callbacks y los dispara con flush().
function fakeTimer() {
  const pending = [];
  return {
    setTimer: (fn, ms) => { pending.push({ fn, ms }); return pending.length; },
    flush: () => pending.splice(0).forEach((t) => t.fn()),
    pending,
  };
}

describe("createCompareClient", () => {
  it("manda la lista de súper y reset() vuelve a pedir", async () => {
    const timer = fakeTimer();
    let list = ["dia"];
    const send = vi.fn(async (eans) => Object.fromEntries(eans.map((e) => [e, { dia: offer }])));
    const client = createCompareClient({ send, stores: () => list, setTimer: timer.setTimer });
    const p = client.request("1");
    timer.flush();
    await p;
    expect(send).toHaveBeenCalledWith(["1"], ["dia"]);
    client.request("1");
    expect(send).toHaveBeenCalledTimes(1);
    list = ["mas"];
    client.reset();
    expect(client.peek("1")).toBeUndefined();
    const q = client.request("1");
    timer.flush();
    await q;
    expect(send).toHaveBeenCalledTimes(2);
    expect(send).toHaveBeenLastCalledWith(["1"], ["mas"]);
  });

  it("junta 3 request del mismo tick en un solo send", async () => {
    const timer = fakeTimer();
    const send = vi.fn(async (eans) => Object.fromEntries(eans.map((e) => [e, { dia: offer }])));
    const client = createCompareClient({ send, setTimer: timer.setTimer });
    const ps = [client.request("1"), client.request("2"), client.request("3")];
    expect(send).not.toHaveBeenCalled();
    expect(timer.pending).toHaveLength(1);
    expect(timer.pending[0].ms).toBe(150);
    timer.flush();
    const res = await Promise.all(ps);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith(["1", "2", "3"], undefined);
    expect(res).toEqual([{ dia: offer }, { dia: offer }, { dia: offer }]);
  });

  it("un EAN ya resuelto no vuelve a llamar a send y peek lo devuelve", async () => {
    const timer = fakeTimer();
    const send = vi.fn(async () => ({ 1: { dia: offer } }));
    const client = createCompareClient({ send, setTimer: timer.setTimer });
    expect(client.peek("1")).toBeUndefined();
    const p = client.request("1");
    timer.flush();
    await p;
    expect(client.peek("1")).toEqual({ dia: offer });
    expect(await client.request("1")).toEqual({ dia: offer });
    expect(send).toHaveBeenCalledTimes(1);
    expect(timer.pending).toHaveLength(0);
  });

  it("un EAN repetido en el mismo tick se manda una sola vez", async () => {
    const timer = fakeTimer();
    const send = vi.fn(async () => ({ 1: { dia: offer } }));
    const client = createCompareClient({ send, setTimer: timer.setTimer });
    const a = client.request("1");
    const b = client.request("1");
    timer.flush();
    expect(await a).toEqual({ dia: offer });
    expect(await b).toEqual({ dia: offer });
    expect(send).toHaveBeenCalledWith(["1"], undefined);
  });

  it("si send rechaza, las promesas resuelven {}", async () => {
    const timer = fakeTimer();
    const send = vi.fn(async () => { throw new Error("boom"); });
    const client = createCompareClient({ send, setTimer: timer.setTimer });
    const ps = [client.request("1"), client.request("2")];
    timer.flush();
    await expect(Promise.all(ps)).resolves.toEqual([{}, {}]);
  });

  it("si send resuelve undefined o sin el EAN, resuelve {}", async () => {
    const timer = fakeTimer();
    const send = vi.fn()
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({ 3: { dia: offer } });
    const client = createCompareClient({ send, setTimer: timer.setTimer });
    const a = client.request("1");
    timer.flush();
    expect(await a).toEqual({});
    const b = client.request("2");
    timer.flush();
    expect(await b).toEqual({});
  });

  it("un pedido posterior al envío arma un lote nuevo", async () => {
    const timer = fakeTimer();
    const send = vi.fn(async (eans) => Object.fromEntries(eans.map((e) => [e, { dia: "missing" }])));
    const client = createCompareClient({ send, setTimer: timer.setTimer });
    const a = client.request("1");
    timer.flush();
    await a;
    const b = client.request("2");
    timer.flush();
    await b;
    expect(send.mock.calls).toEqual([[["1"], undefined], [["2"], undefined]]);
  });
});
