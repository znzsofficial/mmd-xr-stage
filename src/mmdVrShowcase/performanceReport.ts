import { create } from "zustand";
import type { RenderDiagnostics, RenderRequest } from "./renderDiagnostics";

type SceneSample = { models: number; objects: number; physics: boolean; scenery?: string; liveHouse: boolean; shadows: boolean; playing: boolean };
type Window = Omit<RenderDiagnostics, "requested" | "active"> & SceneSample & { elapsedMs: number };
const MAX_WINDOWS = 1800;

/** Aggregates in page memory; only visible XR callback intervals enter the histogram. */
export function createPerformanceRecording(requested: RenderRequest, entryStartedAt: number | null = null) {
  const startedAt = new Date().toISOString();
  const bins = new Uint32Array(8002); // 0.25ms upper bounds, last bin is >2000ms
  const windows: Window[] = [];
  const rates = new Map<number, number>();
  let count = 0, duration = 0, max = 0, knownBudget = 0, over = 0, late = 0, written = 0;
  let skipNext = true;
  let firstVisibleXrFrameMs: number | null = null, firstFrameAfterAssetsReadyMs: number | null = null;
  return {
    startupFrame(assetsReady: boolean) {
      if (entryStartedAt == null || firstFrameAfterAssetsReadyMs !== null) return;
      if (firstVisibleXrFrameMs === null) firstVisibleXrFrameMs = Math.round(performance.now() - entryStartedAt);
      if (assetsReady) firstFrameAfterAssetsReadyMs = Math.round(performance.now() - entryStartedAt);
    },
    interrupt() { skipNext = true; },
    interval(deltaSeconds: number, refreshRate?: number | null) {
      if (!(deltaSeconds > 0) || !Number.isFinite(deltaSeconds)) { skipNext = true; return; }
      if (skipNext) { skipNext = false; return; }
      const ms = deltaSeconds * 1000;
      ++count; duration += ms; max = Math.max(max, ms);
      ++bins[Math.min(bins.length - 1, Math.ceil(ms * 4))];
      if (refreshRate && Number.isFinite(refreshRate) && refreshRate > 0) {
        rates.set(refreshRate, (rates.get(refreshRate) ?? 0) + 1);
        ++knownBudget;
        if (ms > 1000 / refreshRate) ++over;
        if (ms > 1500 / refreshRate) ++late;
      }
    },
    sample(data: RenderDiagnostics, scene: SceneSample) {
      const { requested: _requested, active: _active, ...metrics } = data;
      windows[written++ % MAX_WINDOWS] = { elapsedMs: Math.round(duration), ...scene, ...metrics };
    },
    finish() {
      if (!count) return null;
      const quantile = (q: number) => {
        let n = 0;
        for (let i = 0; i < bins.length - 1; i++) if ((n += bins[i]) >= Math.ceil(count * q)) return i / 4;
        return null;
      };
      const start = written > MAX_WINDOWS ? written % MAX_WINDOWS : 0;
      return { schemaVersion: 1, startedAt, requested, visibleIntervalMs: Math.round(duration), intervalCount: count,
        startup: { firstVisibleXrFrameMs, firstFrameAfterAssetsReadyMs },
        reportedRefreshRates: Object.fromEntries(rates), intervalsWithReportedRate: knownBudget,
        callbackIntervalMs: { mean: duration / count, p50Upper: quantile(.50), p95Upper: quantile(.95), p99Upper: quantile(.99), worst: max },
        overBudgetFraction: knownBudget ? over / knownBudget : null,
        overOneAndHalfBudgetsFraction: knownBudget ? late / knownBudget : null,
        windowsOmitted: Math.max(0, written - MAX_WINDOWS), windows: [...windows.slice(start), ...windows.slice(0, start)],
        notes: "Visible XR callback intervals, not compositor drops or GPU timing. Skip first interval after entry/visibility change. Quantiles are 0.25ms upper bounds; null if above 2000ms. Fractions use each interval's reported Hz. Window model CPU is runtime.update wall time." };
    },
  };
}

type Report = NonNullable<ReturnType<ReturnType<typeof createPerformanceRecording>["finish"]>>;
export const useLastPerformanceReport = create<{ report: Report | null }>(() => ({ report: null }));

export function downloadPerformanceReport(report: Report) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url; link.download = `mmd-xr-performance-${report.startedAt.replace(/[:.]/g, "-")}.json`;
  document.body.appendChild(link);
  try { link.click(); } finally { link.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000); }
}
