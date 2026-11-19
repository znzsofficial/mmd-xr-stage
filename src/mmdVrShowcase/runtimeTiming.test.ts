import { expect, it } from "vitest";
import { createRuntimeTiming } from "./runtimeTiming";

it("reports measured model-update cost and clears stale windows", () => {
  const timing = createRuntimeTiming();
  expect(timing.readAndReset()).toBeNull();
  timing.record(2); timing.record(4); timing.record(NaN); timing.record(-1);
  expect(timing.readAndReset()).toEqual({ mean: 3, max: 4 });
  expect(timing.readAndReset()).toBeNull();
});

it('reports phase means per completed pose, even with multiple models in one frame; reset discards partial windows',()=>{
  const t=createRuntimeTiming();t.recordPose(1,1,1,1);expect(t.readAndReset()).toBeNull();
  t.recordPose(2,1,4,.5);t.recordPose(4,2,8,1.5);t.recordPose(1,1,NaN,0);t.record(22);
  expect(t.readAndReset()).toMatchObject({mean:22,physicsPoseWork:{evaluations:2,animationIkMs:3,prepareMs:1.5,backendMs:6,writeBackMs:1}});
  t.record(3);expect(t.readAndReset()).toEqual({mean:3,max:3});
});
