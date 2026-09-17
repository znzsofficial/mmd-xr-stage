import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import { createFrameCadence, readRenderDiagnostics, useRenderDiagnostics, type RenderRequest } from "../renderDiagnostics";

export function MmdVrDiagnostics({ requested }: { requested: RenderRequest }) {
  const gl = useThree((state) => state.gl);
  const cadence = useRef(createFrameCadence());
  const lastSession = useRef<XRSession | null>(null);
  useEffect(() => () => useRenderDiagnostics.getState().set(null), []);
  useFrame((_, delta) => {
    const session = gl.xr.getSession();
    if (session !== lastSession.current) {
      cadence.current.reset();
      lastSession.current = session;
      useRenderDiagnostics.getState().set(readRenderDiagnostics(gl, requested, null));
    }
    if (!session || !gl.xr.isPresenting) return;
    if ((session.visibilityState && session.visibilityState !== "visible") || !Number.isFinite(delta) || delta <= 0 || delta > 0.5) {
      cadence.current.reset();
      if (useRenderDiagnostics.getState().current?.fps != null) useRenderDiagnostics.getState().set(readRenderDiagnostics(gl, requested, null));
      return;
    }
    const measured = cadence.current.sample(delta);
    if (measured) useRenderDiagnostics.getState().set(readRenderDiagnostics(gl, requested, measured));
  });
  return null;
}
