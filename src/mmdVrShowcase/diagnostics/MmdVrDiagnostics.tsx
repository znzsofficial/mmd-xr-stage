import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import { runtimeTiming } from "./runtimeTiming";
import {xrRoomRestoreTiming} from './roomRestoreTiming';
import {samplePlanetMovement} from '../movement/planetDiagnostics';
import {discardSweepWork,finishSweepFrame,takeSweepWork} from '../movement/sweepWork';
import {takeFigureWork} from './diagramTiming';
import {usePelvic} from '../pelvic/store';
import { useBackpack } from "../backpack/store";
import { useStagePlay } from '../play/stagePlay';
import { createPerformanceRecording, useLastPerformanceReport } from "./performanceReport";
import { useMmdVrStore } from "../mmdVrStore";
import { createFrameCadence, readRenderDiagnostics, useRenderDiagnostics, type RenderRequest } from "./renderDiagnostics";

export function MmdVrDiagnostics({ requested }: { requested: RenderRequest }) {
  const gl = useThree((state) => state.gl);
  const cadence = useRef(createFrameCadence());
  const lastSession = useRef<XRSession | null>(null);
  const recording = useRef<ReturnType<typeof createPerformanceRecording> | null>(null);
  function finish() {
    discardSweepWork();
    xrRoomRestoreTiming.cancel();
    if (recording.current) {
      lastSession.current?.removeEventListener("visibilitychange", recording.current.interrupt);
      lastSession.current?.removeEventListener("visibilitychange", discardSweepWork);
      const report = recording.current.finish();
      if (report) useLastPerformanceReport.setState({ report });
    }
    recording.current = null; lastSession.current = null;
  }
  useEffect(() => () => { finish(); runtimeTiming.readAndReset(); useRenderDiagnostics.getState().set(null); }, []);
  useEffect(()=>useMmdVrStore.subscribe((s,p)=>{
    const r=recording.current;if(!r)return;
    if(!s.overlayOpen||s.entryEpoch!==p.entryEpoch){r.abandonRebuild();xrRoomRestoreTiming.cancel();return;}
    if(s.prefs.scenery!==p.prefs.scenery){r.abandonRebuild();xrRoomRestoreTiming.begin(p.prefs.scenery,s.prefs.scenery,!!useBackpack.getState().layouts[s.prefs.scenery]?.assets.length);return;}
    if(s.physicsBusy&&!p.physicsBusy)r.beginRebuild(s.prefs.scenery,s.physicsEnabled,s.physicsSwitchWork);
    else if(s.physicsBusy&&p.physicsBusy&&s.physicsSwitchWork!==p.physicsSwitchWork)r.abandonRebuild();
    else if(!s.physicsBusy&&p.physicsBusy)r.endRebuild(!s.physicsError&&!s.physicsFatal);
  }),[]);
  useFrame((_, delta, frame) => {
    const session = gl.xr.getSession();
    if (session !== lastSession.current) {
      finish();
      cadence.current.reset();
      runtimeTiming.readAndReset();
      lastSession.current = session;
      if (session) {
        takeFigureWork(session);
        recording.current = createPerformanceRecording(requested, useMmdVrStore.getState().entryStartedAt);
        session.addEventListener("visibilitychange", recording.current.interrupt);
        session.addEventListener("visibilitychange", discardSweepWork);
      }
      useRenderDiagnostics.getState().set(readRenderDiagnostics(gl, requested, null));
    }
    if (!session || !gl.xr.isPresenting) return;
    const visibleFrame = frame?.session === session && (!session.visibilityState || session.visibilityState === "visible");
    if (visibleFrame) {
      const s = useMmdVrStore.getState();
      const restore=xrRoomRestoreTiming.frame(s.prefs.scenery);if(restore)recording.current?.restored(restore);
      recording.current?.startupFrame(!s.assetLoad.running && (s.modelCount > 0 || s.objects.length > 0));
      recording.current?.placementFrame(useBackpack.getState().lastCompletedPlacement);
      recording.current?.interval(delta, session.frameRate);
    }
    else recording.current?.interrupt();
    if (!visibleFrame || !Number.isFinite(delta) || delta <= 0 || delta > 0.5) {
      discardSweepWork();
      cadence.current.reset();
      takeFigureWork(session);
      runtimeTiming.readAndReset();
      if (useRenderDiagnostics.getState().current?.fps != null) useRenderDiagnostics.getState().set(readRenderDiagnostics(gl, requested, null));
      return;
    }
    finishSweepFrame();
    const measured = cadence.current.sample(delta);
    if (measured) {
      const data = readRenderDiagnostics(gl, requested, measured, runtimeTiming.readAndReset());
      useRenderDiagnostics.getState().set(data);
      const s = useMmdVrStore.getState(),figureWork=takeFigureWork(session),rod=usePelvic.getState();
      recording.current?.sample(data, { models: s.models.length, objects: s.objects.length, playing: s.playing,
        ...(figureWork&&{figureWork}),...(rod.active&&{rodState:!rod.active.running?'parked':rod.sample?.outletInside?'inside':'running'}),
        physics: s.physicsEnabled, scenery: s.prefs.scenery, liveHouse: s.prefs.scenery === "liveHouse", shadows: gl.shadowMap.enabled,
        ...(s.prefs.scenery==='glassPlanet'&&{planetMovement:samplePlanetMovement(takeSweepWork())}),
        actorPalmClothRequested:s.prefs.actorPalmCloth, heldToy: useStagePlay.getState().held?.toy ?? null });
    }
  });
  return null;
}
