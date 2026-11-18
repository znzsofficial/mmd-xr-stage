import { describe, expect, it, vi } from "vitest";
import { createPreparedSlot } from "./preparedModel";

describe("prepared model ownership", () => {
  it("transfers an in-flight load exactly once; cleanup by prep cannot dispose the runtime's model", async () => {
    const file = new File([], "a.pmx"), image = new File([], "a.png"), model = {};
    let finish!: (value:object)=>void;
    const load = vi.fn(() => new Promise<object>(done => { finish = done; }));
    const dispose = vi.fn(), slot = createPreparedSlot(load, dispose);
    const warm = slot.warm(file, [file, image]);
    expect(slot.take(file, [file, new File([], "a.png")])).toBeNull();
    const handoff = slot.take(file, [file, image]);
    slot.clear(); expect(slot.take(file, [file, image])).toBeNull();
    await Promise.resolve(); finish(model);
    await expect(handoff).resolves.toBe(model); await expect(warm).resolves.toBe(true);
    expect(load).toHaveBeenCalledOnce(); expect(dispose).not.toHaveBeenCalled();
  });
  it("releases an obsolete late load and a completed unclaimed one, and permits retry after failure", async () => {
    const a = new File([], "a.pmx"), b = new File([], "b.pmx"), dispose = vi.fn();
    let finish!: (v: string)=>void;
    const load = vi.fn<() => Promise<string>>().mockImplementationOnce(() => new Promise(r=>{finish=r;})).mockResolvedValueOnce("B").mockRejectedValueOnce(Error("bad image")).mockResolvedValueOnce("retry");
    const slot = createPreparedSlot(load, dispose); const old = slot.warm(a,[a]); await Promise.resolve();
    const next = slot.warm(b,[b]); finish("A"); await expect(old).resolves.toBe(false); await next;
    expect(dispose.mock.calls).toEqual([["A"]]); slot.clear(); expect(dispose.mock.calls).toEqual([["A"],["B"]]);
    await expect(slot.warm(a,[a])).resolves.toBe(false); expect(slot.take(a,[a])).toBeNull();
    await slot.warm(a,[a]); await expect(slot.take(a,[a])).resolves.toBe("retry");
  });
});
