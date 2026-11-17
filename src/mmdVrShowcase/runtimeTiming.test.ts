import { expect, it } from "vitest";
import { createRuntimeTiming } from "./runtimeTiming";

it("reports measured model-update cost and clears stale windows", () => {
  const timing = createRuntimeTiming();
  expect(timing.readAndReset()).toBeNull();
  timing.record(2); timing.record(4); timing.record(NaN); timing.record(-1);
  expect(timing.readAndReset()).toEqual({ mean: 3, max: 4 });
  expect(timing.readAndReset()).toBeNull();
});
