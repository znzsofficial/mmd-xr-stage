import { describe, it, expect, vi } from "vitest";
import { beginPerformanceAttempt, createPerformanceRecording, publishPerformanceReport, samePagePair,useLastPerformanceReport } from "./performanceReport";
import type { RenderDiagnostics } from "./renderDiagnostics";
import { resetMmdVrClock, setMmdVrClockDuration, setMmdVrClockTime } from '../stage/mmdVrClock';

const request = { frameRate: "120 Hz", antialias: true, framebufferScale: 1, foveation: null };
describe("completed XR performance report", () => {
  it.each(['webgl', 'webgpu'] as const)('exports the single-actor stage clock independently of visible time (%s)', backend => {
    const recording = createPerformanceRecording(request, null, backend);
    const metrics = { requested: request, active: true } as RenderDiagnostics;
    const sample = (models: number, playing: boolean) => {
      recording.interval(1, 120);
      recording.sample(metrics, { models, objects: 0, playing, physics: true, liveHouse: false, shadows: false });
    };
    resetMmdVrClock();
    try {
      sample(1, false); // no motion yet
      setMmdVrClockDuration(16.133333);
      setMmdVrClockTime(11.3204);
      sample(1, true);
      sample(1, false); // held pose while callback time still advances
      setMmdVrClockTime(0);
      sample(1, true); // loop or seek; no extrapolation from elapsedMs
      sample(0, false);
      sample(2, true);
      const { windows } = recording.finish()!;
      expect(windows.map(w => w.elapsedMs)).toEqual([0, 1000, 2000, 3000, 4000, 5000]);
      const held = { timeMs: 11320, durationMs: 16133 };
      expect(windows.map(w => w.stageClock)).toEqual([undefined, held, held, { timeMs: 0, durationMs: 16133 }, undefined, undefined]);
    } finally { resetMmdVrClock(); }
  });
  it('compares only matching single-room runs, retaining a visible stall but not a tracking gap or an invented Hz',()=>{
    const run=(backend:'webgl'|'webgpu',scenes:string[])=>{
      const r=createPerformanceRecording(request,null,backend);scenes.forEach(s=>r.scene(s));
      r.timestamp(100,90);r.timestamp(420,90);r.interrupt();r.timestamp(2600,90);r.timestamp(2610);
      return r.finish()!;
    };
    const gpu=run('webgpu',['floor']);publishPerformanceReport(gpu);
    expect(gpu).toMatchObject({backend:'webgpu',visibleIntervalMs:330,intervalCount:2,reportedRefreshRates:{90:1},overOneAndHalfBudgetsFraction:1});
    const gl=run('webgl',['floor']);publishPerformanceReport(gl);expect(samePagePair()).toEqual({webgpu:gpu,webgl:gl});
    beginPerformanceAttempt('webgpu');expect(samePagePair()).toBeNull();expect(useLastPerformanceReport.getState().report).toBe(gl);
    publishPerformanceReport(gpu);expect(samePagePair()).toEqual({webgpu:gpu,webgl:gl});
    publishPerformanceReport(run('webgl',['floor','classroom']));expect(samePagePair()).toBeNull();
    const classroom=run('webgl',['classroom']);publishPerformanceReport(classroom);expect(samePagePair()).toBeNull();
    publishPerformanceReport(run('webgpu',['classroom']));expect(samePagePair()?.webgl).toBe(classroom);
  });
  it('measures finished rebuilds on a wall clock independent of visible callback gaps, omitting abandoned rooms',()=>{
    const clock=vi.spyOn(performance,'now');try{
      clock.mockReturnValue(1000);const rec=createPerformanceRecording(request);rec.interval(.01,120);rec.interval(.02,120);
      clock.mockReturnValue(2200);rec.beginRebuild('floor',false);rec.abandonRebuild();rec.endRebuild(false);
      clock.mockReturnValue(4000);rec.beginRebuild('astralCourt',true);
      clock.mockReturnValue(8750);rec.endRebuild(true);rec.endRebuild(true);
      expect(rec.finish()).toMatchObject({visibleIntervalMs:20,physicsRebuilds:[{scenery:'astralCourt',requestedEnabled:true,startWallMs:3000,durationWallMs:4750,success:true}]});
    }finally{clock.mockRestore();}
  });
  it("separates aiming and confirmation from time observing the empty room and records each placement once", () => {
    const session = createPerformanceRecording(request, performance.now() - 60000);
    session.startupFrame(false);
    const placement = { token: 3, wasMove:false, kind:'model' as const, confirmedAt:performance.now()-250, previewDelayMs:185 };
    session.placementFrame(placement); session.startupFrame(true); session.placementFrame(placement);
    session.interval(.012,72); session.interval(.012,72);
    const report = session.finish()!;
    expect(report.placements).toHaveLength(1);
    expect(report.placements[0]).toMatchObject({kind:'model',moved:false,selectToPointMs:185});
    expect(report.placements[0].confirmToReadyFrameMs).toBeLessThan(report.startup.firstFrameAfterAssetsReadyMs!);
  });
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
