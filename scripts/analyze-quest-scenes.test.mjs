import assert from 'node:assert/strict';
import test from 'node:test';
import { analyzePair, inspect } from './analyze-quest-scenes.mjs';

// Synthetic only. The recorder rounds both window FPS and elapsedMs; its
// histogram is for the whole session, even when the window ring has wrapped.
function sample(scene, secondRun = false, length = 28, stepMs = 1000) {
  const steady = ['floor', 'lawn'].includes(scene);
  const hz = steady ? 72 : 90;
  const windows = Array.from({ length }, (_, i) => ({
    elapsedMs: (i + 1) * stepMs, models: steady ? 1 : 0, objects: 0, scenery: scene, playing: steady, physics: steady,
    heldToy: null, shadows: false, actorPalmClothRequested: false, refreshRate: hz, layer: 'projection', width: 3360,
    height: 1760, layerAntialias: null, contextAntialias: false, targetSamples: 0, foveation: 0.5,
    fps: hz, frameIntervalMs: +(1000 / hz).toFixed(1), drawCalls: 80, triangles: secondRun ? 21000 : 36000,
    ...(steady && { bulletStepWork: { steps: hz, seedOnly: 0 } }),
  }));
  const visibleIntervalMs = windows.at(-1).elapsedMs, intervals = Math.round(visibleIntervalMs / 1000 * hz);
  return { schemaVersion: 1, startedAt: `2026-11-25T${secondRun ? '14' : '12'}:00:00.000Z`,
    requested: { frameRate: '120 Hz', antialias: false, framebufferScale: null, foveation: null },
    intervalCount: intervals, intervalsWithReportedRate: intervals, reportedRefreshRates: { [hz]: intervals },
    callbackIntervalMs: { p95Upper: steady ? 14 : 11.25, worst: 30 }, windowsOmitted: 0, visibleIntervalMs, windows };
}
const abNotes = { builds: '6061e24,b91325b', quality: 'balanced', view: '计时台', quest: true, spans: '3:27,2:26' };
const steadyNotes = { ...abNotes, builds: 'aa6a0f5,aa6a0f5', view: '角色正前方两米', spans: '1:901,1:901', 'same-actor': true };

test('fixed view: use only complete marked windows and observed session Hz, not requested Hz or whole-session P95', () => {
  const pair = [sample('pool'), sample('pool', true)];
  // The first end inside each mark anchors coverage, not an interval known to be entirely stationary.
  for (const [i, r] of pair.entries()) for (const w of r.windows.slice(0, 3 - i)) Object.assign(w, { fps: 3, triangles: 99000 });
  const result = analyzePair('ab', pair, abNotes);
  assert.deepEqual(result.blockers, []);
  assert.deepEqual(result.medianDeltaBMinusA, { fps: 0, frameIntervalMs: 0, drawCalls: 0, triangles: -15000 });
  assert.equal(result.runs[0].observed.windows, 24);
  assert.equal(result.runs[0].observed.minRoundedFps, 90);
  assert.equal(result.runs[1].coverage.longestContinuousMs, 24000);
  assert.equal(result.runs[1].conditions.refreshRate, 90);
  assert.ok(!('allRoundedWindowsAtLeast72' in result));
});

test('geometry and valid-looking XR counters cannot establish hardware, build, quality, or a matching pose', () => {
  const pair = [sample('classroom'), sample('classroom', true)];
  const undecided = analyzePair('ab', pair);
  for (const flag of ['--quest', '--view', '--quality', '--builds', '--spans']) assert.match(undecided.blockers.join(' '), new RegExp(flag));
  assert.ok(!('medianDeltaBMinusA' in undecided));
  assert.equal(analyzePair('ab', pair, { ...abNotes, builds: 'b91325b,6061e24' }).comparable, false);
  assert.equal(analyzePair('ab', [pair[0], structuredClone(pair[0])], abNotes).comparable, false);
  assert.equal(analyzePair('ab', pair, { ...abNotes, spans: '3:27,2:22' }).comparable, false);
});

test('reject mismatched conditions, including a single contaminated interior sample', () => {
  for (const [edit, expected] of [
    [r => { r.windows.forEach(w => { w.width = 2048; }); }, /width/],
    [r => { r.windows.forEach(w => { w.scenery = 'classroom'; }); }, /scenery/],
    [r => { r.windows.forEach(w => { w.models = 1; }); }, /零演员/],
    [r => { r.windows[9].shadows = true; }, /shadows/],
    [r => { r.windows[9].figureWork = { ticks: 50 }; }, /观察图/],
    [r => { r.windows[9].height = null; }, /height/],
    [r => { r.windows[9].fps = null; }, /FPS/],
    [r => { r.windows[9].refreshRate = null; }, /refreshRate/],
    [r => { r.requested.framebufferScale = 1; }, /渲染请求/],
    [r => { r.windows.forEach(w => { delete w.targetSamples; }); }, /图层画质/],
    [r => { delete r.requested.antialias; }, /画质请求/],
    [r => { r.reportedRefreshRates = { 72: 1, 90: r.intervalCount - 1 }; }, /实际 Hz/],
    [r => { --r.intervalsWithReportedRate; }, /实际 Hz/],
    [r => { r.windows[9].elapsedMs = r.windows[8].elapsedMs; }, /不递增/],
  ]) {
    const pair = [sample('pool'), sample('pool', true)];
    edit(pair[1]);
    const result = analyzePair('ab', pair, abNotes);
    assert.match(result.blockers.join(' '), expected);
    assert.ok(!('medianDeltaBMinusA' in result));
  }
});

test('cloth-lab screen and lab XR windows are not stage measurements', () => {
  const r = { ...sample('pool'), windows: [{ kind: 'screen', fps: 120 }, { kind: 'xr', fps: 72 }] };
  assert.match(inspect(r).problem, /"screen":1,"xr":1/);
  assert.equal(analyzePair('ab', [r, sample('pool', true)], abNotes).comparable, false);
});

test('900 seconds of comparable samples can still miss the target; keep a slow late window and loop reseed', () => {
  const pair = [sample('floor', false, 902), sample('lawn', true, 902)];
  const fast = analyzePair('steady', pair, steadyNotes);
  assert.deepEqual(fast.blockers, []);
  assert.equal(fast.allRoundedWindowsAtLeast72, true);
  const lawn = pair[1];
  lawn.windows[840].bulletStepWork.seedOnly = 1; // normal loop; remaining steps still advanced
  Object.assign(lawn.windows[877], { fps: 36, frameIntervalMs: 27.8 });
  const slow = analyzePair('steady', pair, steadyNotes);
  assert.deepEqual(slow.blockers, []);
  assert.equal(slow.allRoundedWindowsAtLeast72, false);
  assert.equal(slow.runs[1].first60s.windowsBelowReportedHz, 0);
  assert.equal(slow.runs[1].last60s.windowsBelowReportedHz, 1);
  assert.equal(slow.runs[1].observed.minRoundedFps, 36);
});

test('compare 15 minutes by contiguous visible endpoints, not a nominal number of samples', () => {
  const pair = [sample('floor', false, 890, 1014), sample('lawn', true, 890, 1014)];
  const r = analyzePair('steady', pair, { ...steadyNotes, spans: '1:902.46,1:902.46' });
  assert.deepEqual(r.blockers, []);
  assert.equal(r.runs[0].coverage.spanMs, 901446);
  assert.equal(r.runs[0].observed.windows, 889);
  // Elapsed session includes other time; two short series separated by a stall are not a continuous hold.
  const broken = [sample('floor'), sample('lawn', true)];
  for (const d of broken) {
    d.visibleIntervalMs += 875000;
    for (const w of d.windows.slice(14)) w.elapsedMs += 875000;
  }
  const gap = analyzePair('steady', broken, steadyNotes);
  assert.match(gap.blockers.join(' '), /空档/);
  assert.ok(gap.runs.every(run => run.coverage.longestContinuousMs < 15000));
  assert.ok(!('allRoundedWindowsAtLeast72' in gap));
});

test('a short session, truncated prefix, wrong room, missing physics, or a high-rate session cannot certify 72 Hz', () => {
  const pair = [sample('floor', false, 902), sample('lawn', true, 902)];
  pair[0].windowsOmitted = 13; // full-session histogram still exists
  pair[0].windows[0].scenery = 'lawn';
  pair[1].windows[700].bulletStepWork.seedOnly = 72;
  pair[1].reportedRefreshRates = { 120: pair[1].intervalCount };
  pair[1].windows.forEach(w => { w.refreshRate = 120; });
  const blocked = analyzePair('steady', pair, { ...steadyNotes, builds: 'aa6a0f5,b91325b', 'same-actor': false });
  for (const reason of [/截断/, /独立会话/, /实际推进/, /72 Hz/, /相同实测构建/, /same-actor/]) assert.match(blocked.blockers.join(' '), reason);
  assert.ok(!('allRoundedWindowsAtLeast72' in blocked));
  const short = analyzePair('steady', [sample('floor'), sample('lawn', true)], { ...steadyNotes, spans: '1:28,1:28' });
  assert.match(short.blockers.join(' '), /整场可见回调不足 900 秒/);
});
