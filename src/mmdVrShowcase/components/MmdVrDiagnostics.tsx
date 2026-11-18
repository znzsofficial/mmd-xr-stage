import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import { runtimeTiming } from "../runtimeTiming";
import { useBackpack } from "../backpack";
import { useStagePlay } from '../play/stagePlay';
import { createPerformanceRecording, useLastPerformanceReport } from "../performanceReport";
import { useMmdVrStore } from "../mmdVrStore";
import { createFrameCadence, readRenderDiagnostics, useRenderDiagnostics, type RenderRequest } from "../renderDiagnostics";

export function MmdVrDiagnostics({ requested }: { requested: RenderRequest }) {
  const gl = useThree((state) => state.gl);
  const cadence = useRef(createFrameCadence());
  const lastSession = useRef<XRSession | null>(null);
  const recording = useRef<ReturnType<typeof createPerformanceRecording> | null>(null);
  function finish() {
    if (recording.current) {
      lastSession.current?.removeEventListener("visibilitychange", recording.current.interrupt);
      const report = recording.current.finish();
      if (report) useLastPerformanceReport.setState({ report });
    }
    recording.current = null; lastSession.current = null;
  }
  useEffect(() => () => { finish(); runtimeTiming.readAndReset(); useRenderDiagnostics.getState().set(null); }, []);
  useFrame((_, delta, frame) => {
    const session = gl.xr.getSession();
    if (session !== lastSession.current) {
      finish();
      cadence.current.reset();
      runtimeTiming.readAndReset();
      lastSession.current = session;
      if (session) {
        recording.current = createPerformanceRecording(requested, useMmdVrStore.getState().entryStartedAt);
        session.addEventListener("visibilitychange", recording.current.interrupt);
      }
      useRenderDiagnostics.getState().set(readRenderDiagnostics(gl, requested, null));
    }
    if (!session || !gl.xr.isPresenting) return;
    const visibleFrame = frame?.session === session && (!session.visibilityState || session.visibilityState === "visible");
    if (visibleFrame) {
      const s = useMmdVrStore.getState();
      recording.current?.startupFrame(!s.assetLoad.running && (s.modelCount > 0 || s.objects.length > 0));
      recording.current?.placementFrame(useBackpack.getState().lastCompletedPlacement);
      recording.current?.interval(delta, session.frameRate);
    }
    else recording.current?.interrupt();
    if (!visibleFrame || !Number.isFinite(delta) || delta <= 0 || delta > 0.5) {
      cadence.current.reset();
      runtimeTiming.readAndReset();
      if (useRenderDiagnostics.getState().current?.fps != null) useRenderDiagnostics.getState().set(readRenderDiagnostics(gl, requested, null));
      return;
    }
    const measured = cadence.current.sample(delta);
    if (measured) {
      const data = readRenderDiagnostics(gl, requested, measured, runtimeTiming.readAndReset());
      useRenderDiagnostics.getState().set(data);
      const s = useMmdVrStore.getState();
      recording.current?.sample(data, { models: s.models.length, objects: s.objects.length, playing: s.playing,
        physics: s.physicsEnabled, scenery: s.prefs.scenery, liveHouse: s.prefs.scenery === "liveHouse", shadows: gl.shadowMap.enabled,
        heldToy: useStagePlay.getState().held?.toy ?? null });
    }
  });
  return null;
}
