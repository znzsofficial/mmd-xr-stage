import { create } from "zustand";
import { stageBuild } from '../../shared/stageBuild';
import {supportsWebgpuRoom} from '../xr/floorBackend';
import { getMmdVrClock } from '../stage/mmdVrClock';
import type { RenderDiagnostics, RenderRequest } from "./renderDiagnostics";
import type { BackpackPlacementTiming } from "../backpack/store";
import type { SceneryId } from '../scenery/catalog';
import type { RoomRestoreEvent } from './roomRestoreTiming';
import type {PhysicsSwitchWork} from './physicsSwitchWork';
import type {FigureWork} from './diagramTiming';
import type {ModelMemoryTrace} from './modelMemory';

export type XrBackend = 'webgl' | 'webgpu';
type EyeSize = {eye:XREye;width:number;height:number};
type SceneSample = { models: number; objects: number; physics: boolean; scenery?: string; liveHouse: boolean; shadows: boolean; playing: boolean; actorStyle?:string; clothMode?:string; actorPalmClothRequested?:boolean; heldToy?: import('../play/stagePlay').Toy | null; planetMovement?:ReturnType<typeof import('../movement/planetDiagnostics').samplePlanetMovement>;figureWork?:FigureWork;rodState?:'parked'|'running'|'inside' };
type MovementSample = { playerStance?:ReturnType<typeof import('../movement/stanceDiagnostics').samplePlayerStance> };
type Window = Omit<RenderDiagnostics, "requested" | "active"> & SceneSample & MovementSample & {
  elapsedMs: number;
  eyeViewports: EyeSize[];
  intervals: number;
  intervalsWithRate: number;
  slowIntervals: number;
  stageClock?: { timeMs: number; durationMs: number };
};
const MAX_WINDOWS = 1800;

/** Aggregates in page memory; only visible XR callback intervals enter the histogram. */
export function createPerformanceRecording(requested: RenderRequest, entryStartedAt: number | null = null, backend:XrBackend='webgl') {
  const startedAt = new Date().toISOString(), entryAsset = stageBuild('stage');
  const bins = new Uint32Array(8002); // 0.25ms upper bounds, last bin is >2000ms
  const windows: Window[] = [];
  const roomRestores:RoomRestoreEvent[]=[];
  const rates = new Map<number, number>();
  const scenes=new Set<string>();
  const placements: { kind: "model" | "object"; moved: boolean; selectToPointMs: number | null; confirmToReadyFrameMs: number; modelWork?: BackpackPlacementTiming['work'] }[] = [];
  let lastPlacementToken = -1;
  let count = 0, duration = 0, max = 0, knownBudget = 0, over = 0, late = 0, written = 0;
  let skipNext = true;
  let previousTimestamp:number|undefined;
  let eyeViewports:EyeSize[]=[], lastCount=0,lastKnown=0,lastLate=0;
  let firstVisibleXrFrameMs: number | null = null, firstFrameAfterAssetsReadyMs: number | null = null;
  const wallStart=performance.now();
  const physicsRebuilds:{scenery:SceneryId;requestedEnabled:boolean;startWallMs:number;durationWallMs:number;success:boolean;work?:PhysicsSwitchWork}[]=[];
  let rebuilding:{scenery:SceneryId;requestedEnabled:boolean;at:number;work?:PhysicsSwitchWork}|null=null;
  return {
    wallStart,
    scene(name:string){scenes.add(name);},
    // Three fills camera[i].viewport from view[i]'s actual layer viewport before
    // the application callback. Neither a texture-array layer nor a packed GL
    // framebuffer size is the per-eye drawing size. Never retain XRView objects.
    eyes(views:readonly {eye:XREye}[],cameras:readonly {viewport?:{z:number;w:number}}[]) {
      eyeViewports=views.flatMap(({eye},i)=>{
        const v=cameras[i]?.viewport;
        return v && Number.isInteger(v.z) && Number.isInteger(v.w) && v.z>0 && v.w>0 ? [{eye,width:v.z,height:v.w}] : [];
      });
    },
    restored(event:RoomRestoreEvent){if(roomRestores.length===64)roomRestores.shift();roomRestores.push(event);},
    beginRebuild(scenery:SceneryId,requestedEnabled:boolean,work?:PhysicsSwitchWork){rebuilding={scenery,requestedEnabled,at:performance.now(),work};},
    abandonRebuild(){rebuilding=null;},
    endRebuild(success:boolean){
      if(!rebuilding)return;
      const {at,scenery,requestedEnabled,work}=rebuilding;rebuilding=null;
      if(physicsRebuilds.length===64)physicsRebuilds.shift();
      physicsRebuilds.push({scenery,requestedEnabled,startWallMs:Math.round(at-wallStart),durationWallMs:Math.round(performance.now()-at),success,...(work&&{work:{...work}})});
    },
    placementFrame(event: BackpackPlacementTiming | null) {
      if (!event || event.token === lastPlacementToken) return;
      lastPlacementToken = event.token;
      if (placements.length === 120) placements.shift();
      placements.push({ kind: event.kind, moved: event.wasMove, selectToPointMs: event.previewDelayMs, modelWork: event.work,
        confirmToReadyFrameMs: Math.max(0, Math.round(performance.now() - event.confirmedAt)) });
    },
    startupFrame(assetsReady: boolean) {
      if (entryStartedAt == null || firstFrameAfterAssetsReadyMs !== null) return;
      if (firstVisibleXrFrameMs === null) firstVisibleXrFrameMs = Math.round(performance.now() - entryStartedAt);
      if (assetsReady) firstFrameAfterAssetsReadyMs = Math.round(performance.now() - entryStartedAt);
    },
    interrupt() { skipNext = true; previousTimestamp=undefined; },
    timestamp(time:number,rate?:number|null) {
      if(!Number.isFinite(time)){this.interrupt();return;}
      if(previousTimestamp!==undefined && time>previousTimestamp)this.interval((time-previousTimestamp)/1000,rate);
      previousTimestamp=time;skipNext=false;
    },
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
    sample(data: RenderDiagnostics, scene: SceneSample & MovementSample) {
      const { requested: _requested, active: _active, ...metrics } = data;
      // Window-end observation, not a wall-time estimate of the VMD position.
      const { time, duration: motionDuration } = getMmdVrClock();
      const stageClock = scene.models === 1 && motionDuration > 0 && time <= motionDuration
        ? { timeMs: Math.round(time * 1000), durationMs: Math.round(motionDuration * 1000) } : undefined;
      windows[written++ % MAX_WINDOWS] = { elapsedMs: Math.round(duration), ...scene, ...metrics, eyeViewports,
        ...(stageClock && { stageClock }),
        intervals:count-lastCount,intervalsWithRate:knownBudget-lastKnown,slowIntervals:late-lastLate };
      lastCount=count;lastKnown=knownBudget;lastLate=late;
    },
    finish(modelMemory?: ModelMemoryTrace) {
      if (!count) return null;
      const quantile = (q: number) => {
        let n = 0;
        for (let i = 0; i < bins.length - 1; i++) if ((n += bins[i]) >= Math.ceil(count * q)) return i / 4;
        return null;
      };
      const start = written > MAX_WINDOWS ? written % MAX_WINDOWS : 0;
      return { schemaVersion: 1, backend, scenes:[...scenes], eyeViewports, startedAt, entryAsset, requested, visibleIntervalMs: Math.round(duration), intervalCount: count,
         startup: { firstVisibleXrFrameMs, firstFrameAfterAssetsReadyMs }, placements, physicsRebuilds, roomRestores, ...(modelMemory && {modelMemory}),
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

// Only the qualification page offers the two backends in one tab. Keep at most
// one completed run per backend for a single export; never cross page loads.
const pair:Partial<Record<XrBackend,Report>>={};
/** A requested but failed take must not silently export an older take as its
 * half of a new comparison (e.g. an empty floor in place of a dancing actor). */
export function beginPerformanceAttempt(backend:XrBackend) {
  delete pair[backend];
  if(useLastPerformanceReport.getState().report?.backend===backend)useLastPerformanceReport.setState({report:null});
}
export function publishPerformanceReport(report:Report) {
  if(report.scenes.length===1 && supportsWebgpuRoom(report.scenes[0]))pair[report.backend]=report;
  else delete pair[report.backend];
  useLastPerformanceReport.setState({report});
}
export function samePagePair() {return pair.webgpu && pair.webgl && pair.webgpu.scenes[0]===pair.webgl.scenes[0] ? {webgpu:pair.webgpu,webgl:pair.webgl} : null;}

export function downloadPerformanceReport(report: Report, comparison?:NonNullable<ReturnType<typeof samePagePair>>|null) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(comparison??report, null, 2)], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url; link.download = `mmd-xr-performance-${comparison?'webgpu-webgl':report.backend}-${report.startedAt.replace(/[:.]/g, "-")}.json`;
  document.body.appendChild(link);
  try { link.click(); } finally { link.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000); }
}
