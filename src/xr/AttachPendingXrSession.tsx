import { useFrame, useThree } from "@react-three/fiber";
import { useXR } from "@react-three/xr";
import { useEffect, useRef } from "react";
import type { WebGLRenderer } from "three";

export type AttachPendingXrSessionProps = {
  attach: (gl: WebGLRenderer, signal: AbortSignal) => Promise<boolean>;
  markFrame: (gl: WebGLRenderer, session: XRSession) => boolean;
  isCurrent: () => boolean;
  onFail: (detail: string) => void;
};

export function AttachPendingXrSession({ attach, markFrame, isCurrent, onFail }: AttachPendingXrSessionProps) {
  const gl = useThree((s) => s.gl) as WebGLRenderer;
  const activeRef = useRef(false);
  const attemptRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const abort = new AbortController();
    attemptRef.current = abort;
    activeRef.current = false;
    void attach(gl, abort.signal).then((attached) => {
      if (!attached && !abort.signal.aborted && isCurrent()) onFail("XR renderer did not attach");
    }).catch((error) => {
      if (!abort.signal.aborted && isCurrent()) onFail(error instanceof Error ? error.message : "XR renderer attachment failed");
    });
    return () => {
      abort.abort();
      if (attemptRef.current === abort) attemptRef.current = null;
    };
  }, [attach, gl, isCurrent, onFail]);

  useFrame((_, __, frame) => {
    const attempt = attemptRef.current;
    if (!attempt || attempt.signal.aborted || activeRef.current || !frame || !isCurrent()) return;
    if (!markFrame(gl, frame.session)) return;
    activeRef.current = true;
  });
  return null;
}

export function HeadsetHudGate({ onHideHud }: { onHideHud: (hide: boolean) => void }) {
  const session = useXR((state) => state.session);
  useEffect(() => {
    onHideHud(Boolean(session));
  }, [onHideHud, session]);
  return null;
}
