import { describe, expect, it, vi } from "vitest";
import { createAssetLoadQueue, type AssetLoadProgress } from "./mmdAssetLoadQueue";
import { paginateLoadDetails } from "./loadText";

describe("asset loading recovery", () => {
  it("keeps successful models and retries only failed motions", async () => {
    const model = vi.fn(async () => {});
    const motion = vi.fn().mockRejectedValueOnce(new Error("missing motion" )).mockResolvedValue(undefined);
    const publish = vi.fn<(progress: AssetLoadProgress) => void>();
    const queue = createAssetLoadQueue([
      { id: "model", fileName: "long-model-name.pmx", phase: "model", run: model },
      { id: "motion", fileName: "dance.vmd", phase: "body", requires: "model", run: motion },
    ]);
    await queue.run(publish);
    expect(publish.mock.lastCall?.[0]).toMatchObject({ running: false, failures: [{ id: "motion", message: "missing motion" }] });
    expect(publish.mock.calls[0][0]).toMatchObject({ completed: 0, total: 2, fileName: "long-model-name.pmx" });
    await queue.run(publish);
    expect(model).toHaveBeenCalledOnce();
    expect(motion).toHaveBeenCalledTimes(2);
    expect(publish.mock.lastCall?.[0]).toMatchObject({ running: false, total: 1, failures: [] });
  });

  it("blocks dependent motions on failure and resumes them after model recovery", async () => {
    const model = vi.fn().mockRejectedValueOnce(new Error("bad model")).mockResolvedValue(undefined);
    const motion = vi.fn(async () => {});
    const object = vi.fn(async () => {});
    const publish = vi.fn();
    const queue = createAssetLoadQueue([
      { id: "model", fileName: "model.pmx", phase: "model", run: model },
      { id: "motion", fileName: "dance.vmd", phase: "body", requires: "model", run: motion },
      { id: "object", fileName: "stage.glb", phase: "object", run: object },
    ]);
    await queue.run(publish);
    expect(motion).not.toHaveBeenCalled();
    expect(object).toHaveBeenCalledOnce();
    await queue.run(publish);
    expect(model).toHaveBeenCalledTimes(2);
    expect(motion).toHaveBeenCalledOnce();
    expect(object).toHaveBeenCalledOnce();
  });

  it("does not publish late results or start another task after cancellation", async () => {
    let finish!: () => void;
    let cancelled = false;
    const next = vi.fn(async () => {});
    const publish = vi.fn();
    const queue = createAssetLoadQueue([
      { id: "a", fileName: "a.pmx", phase: "model", run: () => new Promise<void>((resolve) => { finish = resolve; }) },
      { id: "b", fileName: "b.pmx", phase: "model", run: next },
    ]);
    const running = queue.run(publish, () => cancelled);
    expect(queue.run(publish)).toBe(running);
    cancelled = true;
    finish();
    await running;
    expect(publish).toHaveBeenCalledOnce();
    expect(next).not.toHaveBeenCalled();
  });

  it("paginates long Unicode paths and errors without losing characters", () => {
    const text = "纹理😀".repeat(150);
    const pages = paginateLoadDetails(text);
    expect(pages.length).toBeGreaterThan(1);
    expect(pages.flat().join("")).toBe(text);
    expect(pages.every((page) => page.length <= 5)).toBe(true);
  });
});
