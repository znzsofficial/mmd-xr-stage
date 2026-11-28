// Offline reader for the stage's schemaVersion: 1 XR performance export.
import { readFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';

const targets = { ab: 20_000, steady: 900_000 };
const abBuilds = ['6061e24', 'b91325b'];
const requestKeys = ['frameRate', 'antialias', 'framebufferScale', 'foveation'];
const conditionKeys = ['scenery', 'models', 'objects', 'playing', 'physics', 'heldToy', 'actorPalmClothRequested',
  'refreshRate', 'shadows', 'layer', 'width', 'height', 'layerAntialias', 'contextAntialias', 'targetSamples', 'foveation'];
const metrics = ['fps', 'frameIntervalMs', 'drawCalls', 'triangles'];
const positive = n => Number.isFinite(n) && n > 0;
const count = n => Number.isSafeInteger(n) && n >= 0;
const pick = (o, keys) => Object.fromEntries(keys.map(k => [k, o?.[k]]));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const differences = (a, b, keys) => keys.filter(k => a?.[k] !== b?.[k]);
const bool = x => typeof x === 'boolean';

// createFrameCadence emits at >=1 second and resets for delta >0.5 seconds.
// elapsedMs is rounded visible time, not wall time. A bigger gap may contain
// an unwindowed stall. Never credit it as a stable window or drop it as noise.
const contiguous = ms => ms >= 999 && ms <= 1501;

function originProblem(r) {
  if (!Array.isArray(r?.windows) || !r.windows.length) return '没有窗口';
  if (r.experiment || r.windows.some(w => !w || typeof w !== 'object' || 'kind' in w)) {
    const kinds = {};
    for (const w of r.windows) { const k = w?.kind ?? 'unknown'; kinds[k] = (kinds[k] ?? 0) + 1; }
    return `不是正式舞台 XR 导出；窗口类型：${JSON.stringify(kinds)}`;
  }
  return r.schemaVersion === 1 && positive(r.visibleIntervalMs) && count(r.intervalCount) && r.intervalCount > 0
    ? null : '缺少正式舞台 v1 的可见 XR 回调计数或时长';
}

function session(r) {
  return { startedAt: r.startedAt, visibleMs: r.visibleIntervalMs, intervalCount: r.intervalCount,
    reportedRefreshRates: r.reportedRefreshRates, intervalsWithReportedRate: r.intervalsWithReportedRate,
    requested: pick(r.requested, requestKeys), retainedWindows: r.windows.length, windowsOmitted: r.windowsOmitted ?? null,
    wholeSessionCallbackP95UpperMs: r.callbackIntervalMs?.p95Upper ?? null,
    wholeSessionWorstMs: r.callbackIntervalMs?.worst ?? null, wholeSessionOver1p5Budgets: r.overOneAndHalfBudgetsFraction ?? null };
}

function median(values) {
  const a = values.toSorted((x, y) => x - y), i = Math.floor(a.length / 2);
  return a.length % 2 ? a[i] : (a[i - 1] + a[i]) / 2;
}

function windowStats(rows) {
  if (!rows.length || rows.some(w => metrics.some(k => !positive(w[k])))) return null;
  return { windows: rows.length, median: Object.fromEntries(metrics.map(k => [k, median(rows.map(w => w[k]))])),
    minRoundedFps: Math.min(...rows.map(w => w.fps)), windowsBelowReportedHz: rows.filter(w => w.fps < w.refreshRate).length,
    maxWindowMeanIntervalMs: Math.max(...rows.map(w => w.frameIntervalMs)) };
}

// Group by observations, never by speed. These runs help locate the operator's
// notes; an unchanged actor count does not mean that the viewer stood still.
export function inspect(r) {
  const problem = originProblem(r);
  if (problem) return { problem };
  const runs = [];
  let run = [];
  function finishRun() {
    runs.push({ conditions: pick(run[0], conditionKeys), firstEndMs: run[0].elapsedMs, lastEndMs: run.at(-1).elapsedMs,
      snapshots: run.length, snapshotStats: windowStats(run) });
  }
  for (const w of r.windows) {
    const prev = run.at(-1);
    if (prev && (!contiguous(w.elapsedMs - prev.elapsedMs) || differences(prev, w, conditionKeys).length)) {
      finishRun(); run = [];
    }
    run.push(w);
  }
  finishRun();
  return { session: session(r), observedRunsNotCameraMarks: runs };
}

function readSpan(s) {
  const m = /^(\d+(?:\.\d{1,3})?):(\d+(?:\.\d{1,3})?)$/.exec(s ?? '');
  if (!m) return null;
  const [from, to] = m.slice(1).map(n => Math.round(Number(n) * 1000));
  return count(from) && count(to) && to > from ? [from, to] : null;
}

function measure(r, mark, mode, index, block) {
  const problem = originProblem(r);
  if (problem) { block(problem); return {}; }
  const result = { session: session(r) };
  if (r.windowsOmitted !== 0) block(`导出窗口截断或截断数未知：windowsOmitted=${r.windowsOmitted ?? '?'}`);
  if (!r.startedAt || !Number.isFinite(Date.parse(r.startedAt))) block('缺少会话开始时间');
  if (typeof r.requested?.frameRate !== 'string' || !bool(r.requested?.antialias) ||
      !['framebufferScale', 'foveation'].every(k => r.requested[k] === null || Number.isFinite(r.requested[k]))) block('画质请求字段不完整');
  if (r.windows.some((w, i, ws) => !count(w.elapsedMs) || w.elapsedMs > r.visibleIntervalMs || (i && w.elapsedMs <= ws[i - 1].elapsedMs))) {
    block('可见窗口时间戳无效或不递增'); return result;
  }
  const hzCounts = Object.entries(r.reportedRefreshRates ?? {});
  if (hzCounts.length !== 1 || !positive(Number(hzCounts[0][0])) || hzCounts[0][1] !== r.intervalCount ||
      r.intervalsWithReportedRate !== r.intervalCount) block('整场实际 Hz 有切换、缺报或计数不符');
  if (mode === 'steady') {
    // New outdoor takes use the station; archived lawn sessions retain their
    // own identity and cannot be stitched to station windows.
    const outdoor = r.windows[0].scenery === 'lawn' ? 'lawn' : 'seasideTerminus';
    const expectedScene = index === 0 ? 'floor' : outdoor;
    if (r.visibleIntervalMs < targets.steady) block('整场可见回调不足 900 秒');
    if (r.windows.some(w => w.scenery !== expectedScene)) block(`必须是 ${expectedScene} 独立会话`);
    if (hzCounts.length !== 1 || Number(hzCounts[0][0]) !== 72) block('持续 72 验收须由会话实际报告 72 Hz');
  }
  const span = readSpan(mark);
  if (!span) { block('需提供操作者标记的起止秒数 --spans'); return result; }
  if (span[1] > r.visibleIntervalMs) block('标记超出可见会话时长');
  const rows = r.windows.filter(w => w.elapsedMs >= span[0] && w.elapsedMs <= span[1]);
  if (rows.length < 2) { block('标记内没有两个完整窗口端点'); return result; }
  // Conditions are snapshots at the end. Use the first end only as the left
  // boundary, then measure full windows; don't extrapolate to the marks.
  const first = rows[0], last = rows.at(-1), measured = rows.slice(1);
  const spanMs = last.elapsedMs - first.elapsedMs;
  let longestMs = 0, runMs = 0, discontinuities = 0;
  for (let i = 1; i < rows.length; ++i) {
    const dt = rows[i].elapsedMs - rows[i - 1].elapsedMs;
    if (contiguous(dt)) { runMs += dt; longestMs = Math.max(longestMs, runMs); }
    else { ++discontinuities; runMs = 0; }
  }
  result.coverage = { markedMs: span, endpointsMs: [first.elapsedMs, last.elapsedMs], spanMs, longestContinuousMs: longestMs, discontinuities };
  if (discontinuities || first.elapsedMs - span[0] > 1501 || span[1] - last.elapsedMs > 1501) block('标记内有采样空档或边界缺窗，不拼接');
  if (longestMs < targets[mode]) block(`完整连续段不足 ${targets[mode] / 1000} 秒`);

  result.conditions = pick(first, conditionKeys);
  const changed = conditionKeys.filter(k => rows.some(w => w[k] !== first[k]));
  if (changed.length) block(`段内条件改变：${changed.join(', ')}`);
  if (!positive(first.refreshRate) || !hzCounts.some(([hz]) => Number(hz) === first.refreshRate)) block('窗口实际 Hz 未知或与会话不符');
  if (!['projection', 'webgl'].includes(first.layer) || !positive(first.width) || !positive(first.height) || !bool(first.shadows)) block('实际 XR 图层、尺寸或阴影未知');
  if (!['layerAntialias', 'contextAntialias', 'targetSamples', 'foveation'].every(k => Object.hasOwn(first, k))) block('缺少图层画质诊断字段');
  if (!bool(first.physics) || !bool(first.playing) || first.objects !== 0 || rows.some(w => w.heldToy !== null || w.rodState || w.figureWork)) block('物件、持具、支架、观察图或播放/物理状态不符合静场条件');
  if (mode === 'ab') {
    if (!['pool', 'classroom'].includes(first.scenery) || first.models !== 0) block('A/B 需要泳池或教室空场（零演员）');
  } else {
    if (first.models !== 1 || first.playing !== true) block('稳态段需要一位播放同一动作的演员');
    if (first.physics && measured.some(w => !count(w.bulletStepWork?.seedOnly) || !(w.bulletStepWork.steps > w.bulletStepWork.seedOnly))) block('物理开启但有未记录实际推进的窗口');
  }
  result.observed = windowStats(measured);
  if (!result.observed) block('窗口缺少有效 FPS、平均回调间隔或绘制计数');
  if (mode === 'steady' && spanMs >= targets.steady) {
    result.first60s = windowStats(measured.filter(w => w.elapsedMs <= first.elapsedMs + 60_000));
    result.last60s = windowStats(measured.filter(w => w.elapsedMs > last.elapsedMs - 60_000));
  }
  return result;
}

export function analyzePair(mode, reports, notes = {}) {
  if (!Object.hasOwn(targets, mode) || reports.length !== 2) throw new Error('须指定 ab 或 steady 及两份报告');
  const blockers = [];
  const block = s => blockers.push(s);
  const builds = (notes.builds ?? '').toLowerCase().split(',');
  if (!notes.quest) block('须确认两份均来自同一台实戴 Quest 3S：--quest');
  if (!notes.view?.trim()) block('须确认两段同机位、朝向、收起面板且未操作，注明参照物：--view');
  if (!['low', 'balanced', 'high'].includes(notes.quality)) block('须确认相同的画质档及覆盖设置：--quality low|balanced|high');
  if (builds.length !== 2 || !builds.every(b => /^[0-9a-f]{7,40}$/.test(b)) ||
    (mode === 'ab' ? !builds.every((b, i) => b.startsWith(abBuilds[i])) : builds[0] !== builds[1])) {
    block(mode === 'ab' ? '按顺序提供实测构建 --builds 6061e24,b91325b' : '两份稳态导出须提供相同实测构建 --builds SHA,SHA');
  }
  if (mode === 'steady' && !notes['same-actor']) block('须确认同一角色、衣着、动作、无腕持或支架道具：--same-actor');
  const spans = (notes.spans ?? '').split(',');
  if (spans.length !== 2) block('--spans 需要两段，以逗号分隔');
  const [a, b] = reports.map((r, i) => measure(r, spans[i], mode, i, s => block(`${'AB'[i]}: ${s}`)));
  if (a.session && b.session) {
    if (a.session.startedAt === b.session.startedAt) block('两份必须来自独立会话，开始时间相同');
    if (!same(a.session.requested, b.session.requested)) block('两份渲染请求不一致');
  }
  if (a.conditions && b.conditions) {
    const diff = differences(a.conditions, b.conditions, conditionKeys.filter(k => mode === 'ab' || k !== 'scenery'));
    if (diff.length) block(`两段条件不一致：${diff.join(', ')}`);
    const markLength = run => run.coverage.markedMs[1] - run.coverage.markedMs[0];
    if (mode === 'ab' && markLength(a) !== markLength(b)) block('A/B 请按采集笔记标记等长时段');
  }
  const result = { mode, comparable: !blockers.length, blockers, operatorNotes: notes, runs: [a, b] };
  if (result.comparable) {
    if (mode === 'ab') result.medianDeltaBMinusA = Object.fromEntries(metrics.map(k => [k, +(b.observed.median[k] - a.observed.median[k]).toFixed(3)]));
    else result.allRoundedWindowsAtLeast72 = [a, b].every(x => x.observed.windowsBelowReportedHz === 0);
  }
  return result;
}

const usage = `node scripts/analyze-quest-scenes.mjs inspect FILE.json [FILE.json ...]
node scripts/analyze-quest-scenes.mjs ab OLD.json NEW.json --quest --builds 6061e24,b91325b --view "参照物" --quality balanced --spans 10:40,12:42
node scripts/analyze-quest-scenes.mjs steady FLOOR.json STATION.json --quest --builds SHA,SHA --view "相对演员的距离与朝向" --quality balanced --same-actor --spans 20:930,25:935
--spans 为各自累计可见秒数，须据实填；确认条件见 docs/performance/next-quest-export.md。`;

if (import.meta.main) {
  try {
    const { positionals: [mode, ...files], values } = parseArgs({ allowPositionals: true, options: {
      help: { type: 'boolean' }, quest: { type: 'boolean' }, 'same-actor': { type: 'boolean' },
      builds: { type: 'string' }, view: { type: 'string' }, quality: { type: 'string' }, spans: { type: 'string' },
    } });
    if (values.help) console.log(usage);
    else {
      if (!(mode === 'inspect' ? files.length > 0 : Object.hasOwn(targets, mode) && files.length === 2)) throw new Error(usage);
      const reports = await Promise.all(files.map(async f => JSON.parse((await readFile(f, 'utf8')).replace(/^\uFEFF/, ''))));
      const output = mode === 'inspect' ? reports.map(inspect) : analyzePair(mode, reports, values);
      console.log(JSON.stringify(output, null, 2));
      if (mode === 'inspect' ? output.some(x => x.problem) : !output.comparable) process.exitCode = 1;
    }
  } catch (e) { console.error(e.message); process.exitCode = 2; }
}
