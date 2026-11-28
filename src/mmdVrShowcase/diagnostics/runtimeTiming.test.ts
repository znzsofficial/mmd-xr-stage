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

it('keeps native step bins separate from pose counts and flushes seed-only samples at a window boundary',()=>{
  const t=createRuntimeTiming();t.recordBullet(5,0,1,true);t.recordBullet(1,8,3,false);t.recordBullet(NaN,2,1,false);t.record(21);
  expect(t.readAndReset()?.bulletStepWork).toEqual({steps:2,seedOnly:1,feedMs:3,worldStepMs:4,outputsMs:2});
  t.recordBullet(3,0,0,true);expect(t.readAndReset()).toBeNull();t.record(4);expect(t.readAndReset()?.bulletStepWork).toBeUndefined();
});

it('reports contact reads outside the actor update and clears them on the next window',()=>{
  const t=createRuntimeTiming();t.record(4);t.recordHapticRead(2.5,false);t.recordHapticRead(.25,true);
  expect(t.readAndReset()).toEqual({mean:4,max:4,controllerHapticWork:{reads:2,positiveReads:1,totalMs:2.75,maxMs:2.5}});
  t.record(3);expect(t.readAndReset()?.controllerHapticWork).toBeUndefined();
});

it('reports one-off fitting separately from recurring skirt display, and leaves ordinary viewing windows empty',()=>{
  const t=createRuntimeTiming();t.recordSkirt('fit',40);t.recordSkirt('display',2);t.recordSkirt('display',5);t.record(8);
  expect(t.readAndReset()?.skirtWork).toEqual({fits:1,fitTotalMs:40,fitMaxMs:40,displays:2,displayTotalMs:7,displayMaxMs:5});
  t.record(3);expect(t.readAndReset()?.skirtWork).toBeUndefined();
});
