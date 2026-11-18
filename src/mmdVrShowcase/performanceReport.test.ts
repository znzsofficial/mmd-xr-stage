import { describe, it, expect } from "vitest";
import { createPerformanceRecording } from "./performanceReport";
import type { RenderDiagnostics } from "./renderDiagnostics";

const request = { frameRate: "120 Hz", antialias: true, framebufferScale: 1, foveation: null };
describe("completed XR performance report", () => {
  it("uses actual Hz as the budget, includes visible stalls and excludes the gap across resume", () => {
    const session = createPerformanceRecording(request);
    session.interval(2, 72); // first callback has no previous immersive frame
    session.interval(.010, 72); session.interval(.012, 90); session.interval(.6, 90);
    session.interrupt(); session.interval(4, 90); session.interval(.020);
    const r = session.finish()!;
    expect(r.intervalCount).toBe(4); expect(r.visibleIntervalMs).toBe(642);
    expect(r.callbackIntervalMs).toMatchObject({ p50Upper: 12, p95Upper: 600, worst: 600 });
    expect(r.reportedRefreshRates).toEqual({72: 1, 90: 2});
    expect(r.overBudgetFraction).toBeCloseTo(2/3); expect(r.overOneAndHalfBudgetsFraction).toBeCloseTo(1/3);
  });
  it("retains a bounded, chronological window series but full-session aggregate and no invented rate", () => {
    const session = createPerformanceRecording(request);
    expect(session.finish()).toBeNull(); session.interval(.01);
    for (let i=0; i<1803; i++) {
      session.interval(.01);
      session.sample({ modelUpdateCpuMs:i, requested:request, active:true } as RenderDiagnostics,
        { models:1, objects:0, physics:true, liveHouse:true, playing:true, shadows:false });
    }
    const r=session.finish()!;
    expect(r.intervalCount).toBe(1803); expect(r.overBudgetFraction).toBeNull();
    expect(r.windowsOmitted).toBe(3); expect(r.windows).toHaveLength(1800);
    expect(r.windows[0].modelUpdateCpuMs).toBe(3); expect(r.windows.at(-1)?.modelUpdateCpuMs).toBe(1802);
  });
});
